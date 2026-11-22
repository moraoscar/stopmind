import Darwin
import ExpoModulesCore
import Foundation
import Network

private let bonjourServiceType = "_stopmind._tcp"

private final class LanWebSocketServer {
  private let queue = DispatchQueue(label: "com.cxvone.stopmind.lanserver.queue")
  private var listener: NWListener?
  private var browser: NWBrowser?
  private var connections: [String: NWConnection] = [:]
  private var nextClientSeq: Int = 0

  var onClientConnected: ((String) -> Void)?
  var onClientDisconnected: ((String) -> Void)?
  var onMessage: ((String, String) -> Void)?
  var onRoomsDiscovered: (([[String: Any]]) -> Void)?

  func start(
    preferredPort: UInt16,
    roomCode: String,
    hostName: String,
    completion: @escaping (Result<UInt16, Error>) -> Void
  ) {
    queue.async {
      self.stopLocked()
      self.startListenerLocked(
        port: preferredPort,
        roomCode: roomCode,
        hostName: hostName,
        allowFallback: true,
        completion: completion
      )
    }
  }

  private func makeService(roomCode: String, hostName: String, port: UInt16) -> NWListener.Service? {
    let cleanCode = roomCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard !cleanCode.isEmpty else { return nil }
    let primaryIp = LanWebSocketServer.getLocalIPv4Addresses().first ?? "127.0.0.1"
    var txtRecord = NWTXTRecord()
    txtRecord["room"] = cleanCode
    txtRecord["ip"] = primaryIp
    txtRecord["port"] = String(port)
    txtRecord["host"] = String(hostName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(24))
    return NWListener.Service(
      name: "STOP-\(cleanCode)",
      type: bonjourServiceType,
      domain: nil,
      txtRecord: txtRecord.data
    )
  }

  private func startListenerLocked(
    port: UInt16,
    roomCode: String,
    hostName: String,
    allowFallback: Bool,
    completion: @escaping (Result<UInt16, Error>) -> Void
  ) {
    let tcpOptions = NWProtocolTCP.Options()
    tcpOptions.enableKeepalive = true
    tcpOptions.keepaliveIdle = 15
    tcpOptions.noDelay = true

    let parameters = NWParameters(tls: nil, tcp: tcpOptions)
    parameters.allowLocalEndpointReuse = true

    let wsOptions = NWProtocolWebSocket.Options()
    wsOptions.autoReplyPing = true
    wsOptions.maximumMessageSize = 1024 * 1024
    parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

    let nwListener: NWListener
    do {
      if port > 0, let nwPort = NWEndpoint.Port(rawValue: port) {
        nwListener = try NWListener(using: parameters, on: nwPort)
      } else {
        nwListener = try NWListener(using: parameters)
      }
    } catch {
      if allowFallback && port != 0 {
        self.startListenerLocked(
          port: 0,
          roomCode: roomCode,
          hostName: hostName,
          allowFallback: false,
          completion: completion
        )
      } else {
        completion(.failure(error))
      }
      return
    }

    if let service = self.makeService(roomCode: roomCode, hostName: hostName, port: port) {
      nwListener.service = service
    }

    self.listener = nwListener
    var completed = false

    nwListener.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        if !completed {
          completed = true
          let boundPort = nwListener.port?.rawValue ?? port
          if boundPort != port,
             let updatedService = self.makeService(roomCode: roomCode, hostName: hostName, port: boundPort) {
            nwListener.service = updatedService
          }
          completion(.success(boundPort))
        }
      case .failed(let error):
        if !completed {
          completed = true
          nwListener.cancel()
          if self.listener === nwListener {
            self.listener = nil
          }
          if allowFallback && port != 0 {
            self.startListenerLocked(
              port: 0,
              roomCode: roomCode,
              hostName: hostName,
              allowFallback: false,
              completion: completion
            )
          } else {
            completion(.failure(error))
          }
        }
      case .cancelled:
        if !completed {
          completed = true
          completion(.failure(NSError(
            domain: "LanServer",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "El servidor WiFi local fue cancelado."]
          )))
        }
      default:
        break
      }
    }

    nwListener.newConnectionHandler = { [weak self] connection in
      self?.handleNewConnectionLocked(connection)
    }

    nwListener.start(queue: queue)
  }

  func stop() {
    queue.async {
      self.stopLocked()
    }
  }

  private func stopLocked() {
    listener?.stateUpdateHandler = nil
    listener?.newConnectionHandler = nil
    listener?.cancel()
    listener = nil

    for (_, conn) in connections {
      conn.stateUpdateHandler = nil
      conn.cancel()
    }
    connections.removeAll()
  }

  func startDiscovery() {
    queue.async {
      self.stopDiscoveryLocked()
      let descriptor = NWBrowser.Descriptor.bonjourWithTXTRecord(
        type: bonjourServiceType,
        domain: nil
      )
      let parameters = NWParameters.tcp
      parameters.includePeerToPeer = true
      let nwBrowser = NWBrowser(for: descriptor, using: parameters)
      self.browser = nwBrowser

      nwBrowser.browseResultsChangedHandler = { [weak self] results, _ in
        guard let self else { return }
        var seenCodes = Set<String>()
        var rooms: [[String: Any]] = []

        for result in results {
          if case .bonjour(let txtRecord) = result.metadata {
            let roomCode = (txtRecord["room"] ?? "").uppercased()
            let ip = txtRecord["ip"] ?? ""
            let port = Int(txtRecord["port"] ?? "3001") ?? 3001
            let hostName = txtRecord["host"] ?? "Anfitrión"
            if !roomCode.isEmpty && !ip.isEmpty && !seenCodes.contains(roomCode) {
              seenCodes.insert(roomCode)
              rooms.append([
                "roomCode": roomCode,
                "ip": ip,
                "port": port,
                "wsUrl": "ws://\(ip):\(port)",
                "hostName": hostName.isEmpty ? "Anfitrión" : hostName
              ])
            }
          }
        }
        self.onRoomsDiscovered?(rooms)
      }

      nwBrowser.start(queue: self.queue)
    }
  }

  func stopDiscovery() {
    queue.async {
      self.stopDiscoveryLocked()
    }
  }

  private func stopDiscoveryLocked() {
    browser?.browseResultsChangedHandler = nil
    browser?.cancel()
    browser = nil
  }

  private func handleNewConnectionLocked(_ connection: NWConnection) {
    nextClientSeq += 1
    let clientId = "c_\(nextClientSeq)_\(Int.random(in: 1000...9999))"
    connections[clientId] = connection

    connection.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        self.onClientConnected?(clientId)
        self.receiveNextMessageLocked(clientId: clientId, connection: connection)
      case .failed, .cancelled:
        self.removeConnectionLocked(clientId: clientId)
      default:
        break
      }
    }

    connection.start(queue: queue)
  }

  private func receiveNextMessageLocked(clientId: String, connection: NWConnection) {
    connection.receiveMessage { [weak self] content, context, _, error in
      guard let self else { return }

      if error != nil {
        self.removeConnectionLocked(clientId: clientId)
        return
      }

      if let metadata = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata {
        switch metadata.opcode {
        case .text:
          if let data = content, let text = String(data: data, encoding: .utf8) {
            self.onMessage?(clientId, text)
          }
        case .binary:
          if let data = content, let text = String(data: data, encoding: .utf8) {
            self.onMessage?(clientId, text)
          }
        case .close:
          self.removeConnectionLocked(clientId: clientId)
          return
        default:
          break
        }
      } else if let data = content, let text = String(data: data, encoding: .utf8), !text.isEmpty {
        self.onMessage?(clientId, text)
      }

      if self.connections[clientId] != nil {
        self.receiveNextMessageLocked(clientId: clientId, connection: connection)
      }
    }
  }

  private func removeConnectionLocked(clientId: String) {
    guard let conn = connections.removeValue(forKey: clientId) else {
      return
    }
    conn.stateUpdateHandler = nil
    conn.cancel()
    onClientDisconnected?(clientId)
  }

  func send(clientId: String, message: String) {
    guard let data = message.data(using: .utf8) else { return }
    queue.async {
      guard let conn = self.connections[clientId] else { return }
      self.sendDataLocked(connection: conn, data: data)
    }
  }

  func broadcast(message: String) {
    guard let data = message.data(using: .utf8) else { return }
    queue.async {
      for (_, conn) in self.connections {
        self.sendDataLocked(connection: conn, data: data)
      }
    }
  }

  private func sendDataLocked(connection: NWConnection, data: Data) {
    let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
    let context = NWConnection.ContentContext(identifier: "text", metadata: [metadata])
    connection.send(
      content: data,
      contentContext: context,
      isComplete: true,
      completion: .contentProcessed { _ in }
    )
  }

  static func getLocalIPv4Addresses() -> [String] {
    var candidates: [(ip: String, priority: Int)] = []
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let firstAddr = ifaddr else {
      return ["127.0.0.1"]
    }
    defer { freeifaddrs(ifaddr) }

    var ptr: UnsafeMutablePointer<ifaddrs>? = firstAddr
    while let current = ptr {
      let flags = Int32(current.pointee.ifa_flags)
      let isUp = (flags & IFF_UP) != 0
      let isLoopback = (flags & IFF_LOOPBACK) != 0

      if isUp && !isLoopback, let addr = current.pointee.ifa_addr, addr.pointee.sa_family == UInt8(AF_INET) {
        let name = String(cString: current.pointee.ifa_name)
        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        let result = getnameinfo(
          addr,
          socklen_t(addr.pointee.sa_len),
          &hostname,
          socklen_t(hostname.count),
          nil,
          0,
          NI_NUMERICHOST
        )
        if result == 0 {
          let ip = String(cString: hostname)
          if !ip.isEmpty && !ip.hasPrefix("169.254.") {
            let priority: Int
            if name == "en0" {
              priority = 0 // WiFi
            } else if name.hasPrefix("bridge") {
              priority = 1 // Personal Hotspot
            } else if name.hasPrefix("en") {
              priority = 2 // Other Ethernet/WiFi
            } else if ip.hasPrefix("192.168.") || ip.hasPrefix("10.") {
              priority = 3
            } else {
              priority = 4
            }
            candidates.append((ip: ip, priority: priority))
          }
        }
      }
      ptr = current.pointee.ifa_next
    }

    candidates.sort { $0.priority < $1.priority }
    var seen = Set<String>()
    var unique: [String] = []
    for item in candidates where !seen.contains(item.ip) {
      seen.insert(item.ip)
      unique.append(item.ip)
    }

    return unique.isEmpty ? ["127.0.0.1"] : unique
  }
}

public class LanServerModule: Module {
  private let server = LanWebSocketServer()

  public func definition() -> ModuleDefinition {
    Name("LanServer")

    Events("onClientConnected", "onClientDisconnected", "onMessage", "onRoomsDiscovered")

    OnCreate {
      self.server.onClientConnected = { [weak self] clientId in
        self?.sendEvent("onClientConnected", ["clientId": clientId])
      }
      self.server.onClientDisconnected = { [weak self] clientId in
        self?.sendEvent("onClientDisconnected", ["clientId": clientId])
      }
      self.server.onMessage = { [weak self] clientId, message in
        self?.sendEvent("onMessage", ["clientId": clientId, "message": message])
      }
      self.server.onRoomsDiscovered = { [weak self] rooms in
        self?.sendEvent("onRoomsDiscovered", ["rooms": rooms])
      }
    }

    OnDestroy {
      self.server.stopDiscovery()
      self.server.stop()
    }

    AsyncFunction("startServer") { (port: Int, roomCode: String?, hostName: String?, promise: Promise) in
      let safePort = UInt16(max(0, min(65535, port)))
      self.server.start(
        preferredPort: safePort,
        roomCode: roomCode ?? "",
        hostName: hostName ?? "Anfitrión"
      ) { result in
        switch result {
        case .success(let boundPort):
          let ips = LanWebSocketServer.getLocalIPv4Addresses()
          let primaryIp = ips.first ?? "127.0.0.1"
          promise.resolve([
            "ip": primaryIp,
            "ips": ips,
            "port": Int(boundPort),
            "wsUrl": "ws://\(primaryIp):\(boundPort)"
          ])
        case .failure(let error):
          promise.reject("ERR_LAN_SERVER_START", error.localizedDescription)
        }
      }
    }

    Function("stopServer") {
      self.server.stop()
    }

    Function("sendToClient") { (clientId: String, message: String) in
      self.server.send(clientId: clientId, message: message)
    }

    Function("broadcast") { (message: String) in
      self.server.broadcast(message: message)
    }

    Function("getLocalIps") { () -> [String] in
      return LanWebSocketServer.getLocalIPv4Addresses()
    }

    Function("startDiscovery") {
      self.server.startDiscovery()
    }

    Function("stopDiscovery") {
      self.server.stopDiscovery()
    }
  }
}
