package expo.modules.lanserver

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Base64
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

private const val WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
private const val NSD_SERVICE_TYPE = "_stopmind._tcp."

private class ClientSession(
  val id: String,
  val socket: Socket,
  val output: OutputStream
) {
  @Synchronized
  fun sendFrame(opcode: Int, payload: ByteArray) {
    try {
      val header = ByteArrayOutputStream()
      header.write(0x80 or (opcode and 0x0F))
      val len = payload.size
      when {
        len <= 125 -> header.write(len)
        len <= 65535 -> {
          header.write(126)
          header.write((len shr 8) and 0xFF)
          header.write(len and 0xFF)
        }
        else -> {
          header.write(127)
          val longLen = len.toLong()
          for (shift in 56 downTo 0 step 8) {
            header.write(((longLen shr shift) and 0xFF).toInt())
          }
        }
      }
      output.write(header.toByteArray())
      output.write(payload)
      output.flush()
    } catch (_: Exception) {
    }
  }

  fun closeQuietly() {
    try {
      socket.close()
    } catch (_: Exception) {
    }
  }
}

class LanServerModule : Module() {
  private var serverSocket: ServerSocket? = null
  private var executor: ExecutorService? = null
  private val clients = ConcurrentHashMap<String, ClientSession>()
  private val seq = AtomicInteger(0)

  private var registrationListener: NsdManager.RegistrationListener? = null
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null
  private val discoveredRooms = ConcurrentHashMap<String, Map<String, Any>>()

  private val nsdManager: NsdManager?
    get() = appContext.reactContext?.getSystemService(Context.NSD_SERVICE) as? NsdManager

  private val wifiManager: WifiManager?
    get() = appContext.reactContext?.applicationContext?.getSystemService(Context.WIFI_SERVICE) as? WifiManager

  private fun acquireMulticastLock() {
    try {
      if (multicastLock?.isHeld == true) return
      val lock = wifiManager?.createMulticastLock("stopmind-nsd-lock") ?: return
      lock.setReferenceCounted(false)
      lock.acquire()
      multicastLock = lock
    } catch (_: Exception) {
    }
  }

  private fun releaseMulticastLockIfIdle() {
    if (registrationListener != null || discoveryListener != null) return
    try {
      if (multicastLock?.isHeld == true) {
        multicastLock?.release()
      }
    } catch (_: Exception) {
    }
    multicastLock = null
  }

  override fun definition() = ModuleDefinition {
    Name("LanServer")

    Events("onClientConnected", "onClientDisconnected", "onMessage", "onRoomsDiscovered")

    OnDestroy {
      stopDiscoveryInternal()
      stopServerInternal()
    }

    AsyncFunction("startServer") { port: Int, roomCode: String?, hostName: String?, promise: Promise ->
      try {
        stopServerInternal()
        val socket = try {
          ServerSocket(port.coerceIn(0, 65535)).apply { reuseAddress = true }
        } catch (_: Exception) {
          ServerSocket(0).apply { reuseAddress = true }
        }
        serverSocket = socket
        val pool = Executors.newCachedThreadPool()
        executor = pool

        pool.execute { acceptLoop(socket, pool) }

        val ips = getLocalIPv4Addresses()
        val primaryIp = ips.firstOrNull() ?: "127.0.0.1"
        val boundPort = socket.localPort

        registerNsdService(
          roomCode = roomCode?.trim()?.uppercase() ?: "",
          hostName = hostName?.trim()?.take(24) ?: "Anfitrión",
          ip = primaryIp,
          port = boundPort
        )

        promise.resolve(
          mapOf(
            "ip" to primaryIp,
            "ips" to ips,
            "port" to boundPort,
            "wsUrl" to "ws://$primaryIp:$boundPort"
          )
        )
      } catch (e: Exception) {
        promise.reject("ERR_LAN_SERVER_START", e.message ?: "Error al iniciar servidor WiFi", e)
      }
    }

    Function("stopServer") {
      stopServerInternal()
    }

    Function("sendToClient") { clientId: String, message: String ->
      val session = clients[clientId] ?: return@Function
      val bytes = message.toByteArray(Charsets.UTF_8)
      executor?.execute { session.sendFrame(0x1, bytes) }
    }

    Function("broadcast") { message: String ->
      val bytes = message.toByteArray(Charsets.UTF_8)
      val snapshot = clients.values.toList()
      executor?.execute {
        for (session in snapshot) {
          session.sendFrame(0x1, bytes)
        }
      }
    }

    Function("getLocalIps") {
      getLocalIPv4Addresses()
    }

    Function("startDiscovery") {
      startDiscoveryInternal()
    }

    Function("stopDiscovery") {
      stopDiscoveryInternal()
    }
  }

  private fun registerNsdService(roomCode: String, hostName: String, ip: String, port: Int) {
    if (roomCode.isEmpty()) return
    val manager = nsdManager ?: return
    unregisterNsdService()
    acquireMulticastLock()

    try {
      val info = NsdServiceInfo().apply {
        serviceName = "STOP-$roomCode"
        serviceType = NSD_SERVICE_TYPE
        setPort(port)
        setAttribute("room", roomCode)
        setAttribute("ip", ip)
        setAttribute("port", port.toString())
        setAttribute("host", hostName)
      }
      val listener = object : NsdManager.RegistrationListener {
        override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {}
        override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
        override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {}
        override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
      }
      registrationListener = listener
      manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (_: Exception) {
    }
  }

  private fun unregisterNsdService() {
    val listener = registrationListener ?: return
    registrationListener = null
    try {
      nsdManager?.unregisterService(listener)
    } catch (_: Exception) {
    }
    releaseMulticastLockIfIdle()
  }

  private fun emitDiscoveredRooms() {
    val list = discoveredRooms.values.toList()
    sendEvent("onRoomsDiscovered", mapOf("rooms" to list))
  }

  @Suppress("DEPRECATION")
  private fun startDiscoveryInternal() {
    stopDiscoveryInternal()
    val manager = nsdManager ?: return
    discoveredRooms.clear()
    acquireMulticastLock()

    val listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(regType: String) {}
      override fun onServiceFound(service: NsdServiceInfo) {
        if (!service.serviceType.contains("_stopmind")) return
        try {
          manager.resolveService(
            service,
            object : NsdManager.ResolveListener {
              override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
              override fun onServiceResolved(resolved: NsdServiceInfo) {
                val attrs = resolved.attributes
                val roomCode = attrs["room"]?.toString(Charsets.UTF_8)?.uppercase()
                  ?: resolved.serviceName.removePrefix("STOP-").uppercase()
                val ip = attrs["ip"]?.toString(Charsets.UTF_8)
                  ?: resolved.host?.hostAddress
                  ?: return
                val port = attrs["port"]?.toString(Charsets.UTF_8)?.toIntOrNull()
                  ?: resolved.port
                val hostName = attrs["host"]?.toString(Charsets.UTF_8) ?: "Anfitrión"

                if (roomCode.isNotEmpty() && ip.isNotEmpty()) {
                  discoveredRooms[resolved.serviceName] = mapOf(
                    "roomCode" to roomCode,
                    "ip" to ip,
                    "port" to port,
                    "wsUrl" to "ws://$ip:$port",
                    "hostName" to hostName
                  )
                  emitDiscoveredRooms()
                }
              }
            }
          )
        } catch (_: Exception) {
        }
      }

      override fun onServiceLost(service: NsdServiceInfo) {
        if (discoveredRooms.remove(service.serviceName) != null) {
          emitDiscoveredRooms()
        }
      }

      override fun onDiscoveryStopped(serviceType: String) {}
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
    }

    discoveryListener = listener
    try {
      manager.discoverServices(NSD_SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (_: Exception) {
    }
  }

  private fun stopDiscoveryInternal() {
    val listener = discoveryListener ?: return
    discoveryListener = null
    try {
      nsdManager?.stopServiceDiscovery(listener)
    } catch (_: Exception) {
    }
    discoveredRooms.clear()
    releaseMulticastLockIfIdle()
  }

  private fun stopServerInternal() {
    unregisterNsdService()
    try {
      serverSocket?.close()
    } catch (_: Exception) {
    }
    serverSocket = null

    for ((_, session) in clients) {
      session.closeQuietly()
    }
    clients.clear()

    executor?.shutdownNow()
    executor = null
  }

  private fun acceptLoop(server: ServerSocket, pool: ExecutorService) {
    while (!server.isClosed) {
      try {
        val clientSocket = server.accept()
        clientSocket.tcpNoDelay = true
        pool.execute { handleClient(clientSocket) }
      } catch (_: Exception) {
        break
      }
    }
  }

  private fun handleClient(socket: Socket) {
    val input = BufferedInputStream(socket.getInputStream())
    val output = socket.getOutputStream()

    if (!performHandshake(input, output)) {
      try {
        socket.close()
      } catch (_: Exception) {
      }
      return
    }

    val clientId = "c_${seq.incrementAndGet()}_${(1000..9999).random()}"
    val session = ClientSession(clientId, socket, output)
    clients[clientId] = session
    sendEvent("onClientConnected", bundleOf("clientId" to clientId))

    try {
      val messageBuffer = ByteArrayOutputStream()
      while (!socket.isClosed) {
        val b0 = input.read()
        if (b0 == -1) break
        val b1 = input.read()
        if (b1 == -1) break

        val fin = (b0 and 0x80) != 0
        val opcode = b0 and 0x0F
        val masked = (b1 and 0x80) != 0
        var payloadLen = (b1 and 0x7F).toLong()

        if (payloadLen == 126L) {
          val hi = input.read()
          val lo = input.read()
          if (hi == -1 || lo == -1) break
          payloadLen = ((hi shl 8) or lo).toLong()
        } else if (payloadLen == 127L) {
          var len = 0L
          for (i in 0 until 8) {
            val byte = input.read()
            if (byte == -1) return
            len = (len shl 8) or (byte.toLong() and 0xFF)
          }
          payloadLen = len
        }

        val maskKey = ByteArray(4)
        if (masked) {
          if (!readFully(input, maskKey)) break
        }

        if (payloadLen > 1024 * 1024) break
        val payload = ByteArray(payloadLen.toInt())
        if (payloadLen > 0 && !readFully(input, payload)) break

        if (masked) {
          for (i in payload.indices) {
            payload[i] = (payload[i].toInt() xor maskKey[i % 4].toInt()).toByte()
          }
        }

        when (opcode) {
          0x8 -> {
            session.sendFrame(0x8, ByteArray(0))
            break
          }
          0x9 -> {
            session.sendFrame(0xA, payload)
          }
          0xA -> {
          }
          0x1, 0x2, 0x0 -> {
            messageBuffer.write(payload)
            if (fin) {
              val text = messageBuffer.toString("UTF-8")
              messageBuffer.reset()
              sendEvent("onMessage", bundleOf("clientId" to clientId, "message" to text))
            }
          }
        }
      }
    } catch (_: Exception) {
    } finally {
      clients.remove(clientId)
      session.closeQuietly()
      sendEvent("onClientDisconnected", bundleOf("clientId" to clientId))
    }
  }

  private fun performHandshake(input: InputStream, output: OutputStream): Boolean {
    val headerBuf = ByteArrayOutputStream()
    var prev3 = 0
    var prev2 = 0
    var prev1 = 0
    var count = 0
    while (count < 8192) {
      val b = input.read()
      if (b == -1) return false
      headerBuf.write(b)
      count++
      if (prev3 == '\r'.code && prev2 == '\n'.code && prev1 == '\r'.code && b == '\n'.code) {
        break
      }
      prev3 = prev2
      prev2 = prev1
      prev1 = b
    }

    val headersText = headerBuf.toString("UTF-8")
    var wsKey: String? = null
    for (line in headersText.split("\r\n")) {
      val idx = line.indexOf(':')
      if (idx > 0) {
        val name = line.substring(0, idx).trim()
        if (name.equals("Sec-WebSocket-Key", ignoreCase = true)) {
          wsKey = line.substring(idx + 1).trim()
        }
      }
    }

    val key = wsKey ?: return false
    val digest = MessageDigest.getInstance("SHA-1").digest((key + WS_GUID).toByteArray(Charsets.UTF_8))
    val accept = Base64.encodeToString(digest, Base64.NO_WRAP)

    val response =
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      "Sec-WebSocket-Accept: $accept\r\n\r\n"
    output.write(response.toByteArray(Charsets.UTF_8))
    output.flush()
    return true
  }

  private fun readFully(input: InputStream, dest: ByteArray): Boolean {
    var offset = 0
    while (offset < dest.size) {
      val read = input.read(dest, offset, dest.size - offset)
      if (read == -1) return false
      offset += read
    }
    return true
  }

  private fun getLocalIPv4Addresses(): List<String> {
    val candidates = mutableListOf<Pair<String, Int>>()
    try {
      val interfaces = NetworkInterface.getNetworkInterfaces()
      while (interfaces.hasMoreElements()) {
        val iface = interfaces.nextElement()
        if (!iface.isUp || iface.isLoopback) continue
        val name = iface.name.lowercase()
        val addrs = iface.inetAddresses
        while (addrs.hasMoreElements()) {
          val addr = addrs.nextElement()
          if (addr is Inet4Address && !addr.isLoopbackAddress) {
            val ip = addr.hostAddress ?: continue
            if (ip.startsWith("169.254.")) continue
            val priority = when {
              name.startsWith("wlan") -> 0
              name.startsWith("ap") || name.startsWith("swlan") -> 1
              ip.startsWith("192.168.") || ip.startsWith("10.") -> 2
              else -> 3
            }
            candidates.add(ip to priority)
          }
        }
      }
    } catch (_: Exception) {
    }

    candidates.sortBy { it.second }
    val unique = candidates.map { it.first }.distinct()
    return if (unique.isEmpty()) listOf("127.0.0.1") else unique
  }
}
