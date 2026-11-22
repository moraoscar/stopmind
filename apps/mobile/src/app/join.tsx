import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DiscoveredLanRoom,
  getLanServerNativeModule,
} from '../../modules/lan-server';
import { QrScannerView } from '../components/QrScannerView';
import { COLORS } from '../constants/game';
import { useGame } from '../context/GameContext';
import { formatSeconds, parseJoinQrPayload } from '../utils/network';

export default function JoinScreen() {
  const params = useLocalSearchParams<{ ws?: string; room?: string }>();
  const {
    playerName,
    setPlayerName,
    serverUrl,
    connectionStatus,
    room,
    playerId,
    errorMessage,
    clearError,
    joinLanRoom,
    leaveGame,
  } = useGame();

  const [mode, setMode] = useState<'qr' | 'manual'>(
    params.room ? 'manual' : 'qr'
  );
  const [roomCodeInput, setRoomCodeInput] = useState(
    typeof params.room === 'string' ? params.room.toUpperCase() : ''
  );
  const [wsInput, setWsInput] = useState(
    typeof params.ws === 'string' ? params.ws : serverUrl
  );
  const [showServerField, setShowServerField] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scanResetSignal, setScanResetSignal] = useState(0);
  const [discoveredRooms, setDiscoveredRooms] = useState<DiscoveredLanRoom[]>(
    []
  );

  const autoJoinedRef = useRef(false);
  const joiningRef = useRef(false);

  // Discover nearby STOP! rooms on the same WiFi automatically (Bonjour / NSD)
  useEffect(() => {
    if (connectionStatus === 'connected') return;
    const native = getLanServerNativeModule();
    if (!native) return;

    const sub = native.addListener('onRoomsDiscovered', ({ rooms }) => {
      const list = Array.isArray(rooms) ? rooms : [];
      setDiscoveredRooms(list);
      if (list.length > 0) {
        setWsInput((prev) =>
          prev.includes('192.168.1.100') ? list[0].wsUrl : prev
        );
      }
    });

    native.startDiscovery();
    return () => {
      sub.remove();
      native.stopDiscovery();
    };
  }, [connectionStatus]);

  // Auto-join if launched from a deep link QR
  useEffect(() => {
    if (autoJoinedRef.current) return;
    if (typeof params.ws === 'string' && typeof params.room === 'string') {
      autoJoinedRef.current = true;
      void joinLanRoom(params.ws, params.room);
    }
  }, [joinLanRoom, params.room, params.ws]);

  const attemptJoin = async (targetWs: string, targetCode: string) => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    clearError();
    setLocalError(null);
    try {
      const ok = await joinLanRoom(targetWs, targetCode);
      if (!ok) {
        setScanResetSignal((n) => n + 1);
      }
    } finally {
      joiningRef.current = false;
    }
  };

  const handleQrScanned = (rawData: string) => {
    if (joiningRef.current || connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return;
    }
    const parsed = parseJoinQrPayload(rawData);
    if (!parsed) {
      setLocalError(
        'Ese código QR no corresponde a una sala de StopMind!. Pide al anfitrión el QR de invitación.'
      );
      setScanResetSignal((n) => n + 1);
      return;
    }
    setWsInput(parsed.wsUrl);
    setRoomCodeInput(parsed.roomCode);
    void attemptJoin(parsed.wsUrl, parsed.roomCode);
  };

  const handleManualJoin = () => {
    clearError();
    setLocalError(null);
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setLocalError('Ingresa el código de 4 caracteres de la sala.');
      return;
    }

    // Auto-resolve host phone IP from WiFi Bonjour discovery so manual code works WITHOUT scanning QR first!
    const matchedDiscovered = discoveredRooms.find(
      (r) => r.roomCode.toUpperCase() === cleanCode
    );
    const targetWs = matchedDiscovered?.wsUrl ?? wsInput;
    if (matchedDiscovered) {
      setWsInput(matchedDiscovered.wsUrl);
    }
    void attemptJoin(targetWs, cleanCode);
  };

  const activeError = localError || errorMessage;

  // Connected Guest Lobby View
  if (connectionStatus === 'connected' && room) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={leaveGame} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Sala {room.roomCode}</Text>
          <View style={styles.connectedBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.connectedText}>WiFi</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.waitingHero}>
            <ActivityIndicator size="large" color={COLORS.indigo} />
            <Text style={styles.waitingTitle}>¡Ya estás en la sala!</Text>
            <Text style={styles.waitingSub}>
              Esperando a que el anfitrión presione JUGAR…
            </Text>
          </View>

          {/* Connected Players */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Jugadores ({room.players.length})
            </Text>
            <View style={styles.chipsWrap}>
              {room.players.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.playerChip,
                    p.id === playerId && styles.playerChipMe,
                  ]}
                >
                  <View style={styles.onlineDot} />
                  <Text style={styles.playerChipText}>
                    {p.name}
                    {p.isHost ? ' (Anfitrión)' : p.id === playerId ? ' (Tú)' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Live Room Config Preview */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reglas de esta partida</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="timer-outline" size={18} color={COLORS.stopRed} />
                <Text style={styles.metaValue}>
                  {formatSeconds(room.config.timeLimitSeconds)}
                </Text>
                <Text style={styles.metaLabel}>por ronda</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="repeat" size={18} color={COLORS.emerald} />
                <Text style={styles.metaValue}>{room.config.totalRounds}</Text>
                <Text style={styles.metaLabel}>
                  {room.config.totalRounds === 1 ? 'ronda' : 'rondas'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="text-outline" size={18} color={COLORS.indigo} />
                <Text style={styles.metaValue}>
                  {room.config.allowedLetters?.length ?? 21}
                </Text>
                <Text style={styles.metaLabel}>letras</Text>
              </View>
            </View>

            <View style={styles.chipsWrap}>
              {room.config.categories.map((cat) => (
                <View key={cat} style={styles.catPreviewChip}>
                  <Text style={styles.catPreviewText}>{cat}</Text>
                </View>
              ))}
            </View>

            {room.config.hintsEnabled && (
              <Text style={styles.hintRulePreview}>
                💡 Ayuda activa:{' '}
                {room.config.hintPenaltyMode === 'points'
                  ? `−${room.config.hintPenaltyPoints} pts por ayuda`
                  : room.config.hintPenaltyMode === 'lock'
                    ? `${room.config.hintLockSeconds}s de bloqueo`
                    : `−${room.config.hintPenaltyPoints} pts + ${room.config.hintLockSeconds}s de bloqueo`}
              </Text>
            )}
          </View>

          <Pressable onPress={leaveGame} style={styles.leaveBtn}>
            <Text style={styles.leaveBtnText}>Salir de la sala</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={leaveGame} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Unirse por WiFi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Player Name */}
          <View style={styles.card}>
            <Text style={styles.label}>Tu nombre</Text>
            <TextInput
              style={styles.input}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Escribe tu nombre"
              placeholderTextColor={COLORS.slate}
              maxLength={22}
            />
          </View>

          {/* Auto-discovered WiFi rooms (1-tap join without needing QR or IP!) */}
          {discoveredRooms.length > 0 && (
            <View style={styles.card}>
              <View style={styles.discoveredHeader}>
                <Ionicons name="wifi" size={16} color={COLORS.emerald} />
                <Text style={styles.sectionTitle}>
                  Partidas encontradas en tu WiFi
                </Text>
              </View>
              {discoveredRooms.map((item) => (
                <Pressable
                  key={`${item.roomCode}-${item.ip}`}
                  onPress={() => {
                    setWsInput(item.wsUrl);
                    setRoomCodeInput(item.roomCode);
                    void attemptJoin(item.wsUrl, item.roomCode);
                  }}
                  disabled={connectionStatus === 'connecting'}
                  style={({ pressed }) => [
                    styles.discoveredRow,
                    pressed && styles.discoveredRowPressed,
                  ]}
                >
                  <View style={styles.discoveredCodePill}>
                    <Text style={styles.discoveredCodeText}>
                      {item.roomCode}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.discoveredHost}>
                      Sala de {item.hostName}
                    </Text>
                    <Text style={styles.discoveredIp}>{item.ip}</Text>
                  </View>
                  <View style={styles.tapJoinPill}>
                    <Text style={styles.tapJoinText}>Unirse</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => {
                setMode('qr');
                setLocalError(null);
              }}
              style={[styles.tab, mode === 'qr' && styles.tabActive]}
            >
              <Ionicons
                name="qr-code-outline"
                size={18}
                color={mode === 'qr' ? '#FFFFFF' : COLORS.ink}
              />
              <Text
                style={[styles.tabText, mode === 'qr' && styles.tabTextActive]}
              >
                Escanear QR
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('manual');
                setLocalError(null);
              }}
              style={[styles.tab, mode === 'manual' && styles.tabActive]}
            >
              <Ionicons
                name="keypad-outline"
                size={18}
                color={mode === 'manual' ? '#FFFFFF' : COLORS.ink}
              />
              <Text
                style={[
                  styles.tabText,
                  mode === 'manual' && styles.tabTextActive,
                ]}
              >
                Código manual
              </Text>
            </Pressable>
          </View>

          {activeError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={COLORS.stopRedDark} />
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          {mode === 'qr' ? (
            <View style={styles.qrSection}>
              <QrScannerView
                onScanned={handleQrScanned}
                onSwitchToManual={() => {
                  setMode('manual');
                  setLocalError(null);
                }}
                disabled={connectionStatus === 'connecting'}
                resetSignal={scanResetSignal}
              />
              {connectionStatus === 'connecting' && (
                <View style={styles.connectingBar}>
                  <ActivityIndicator size="small" color={COLORS.indigo} />
                  <Text style={styles.connectingText}>
                    Conectando a la sala por WiFi…
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.label}>Código de sala</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={roomCodeInput}
                onChangeText={(t) => setRoomCodeInput(t.toUpperCase())}
                placeholder="ABCD"
                placeholderTextColor={COLORS.slate}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />

              <Pressable
                onPress={handleManualJoin}
                disabled={connectionStatus === 'connecting'}
                style={({ pressed }) => [
                  styles.joinSubmitBtn,
                  pressed && styles.joinSubmitBtnPressed,
                ]}
              >
                {connectionStatus === 'connecting' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.joinSubmitText}>UNIRSE A LA SALA</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowServerField((v) => !v)}
                style={styles.advancedToggle}
              >
                <Ionicons name="wifi-outline" size={14} color={COLORS.inkMuted} />
                <Text style={styles.advancedToggleText}>
                  {showServerField
                    ? 'Ocultar IP manual del anfitrión'
                    : discoveredRooms.length > 0
                      ? 'IP detectada automáticamente por WiFi'
                      : 'Ingresar IP del anfitrión manualmente (opcional)'}
                </Text>
              </Pressable>

              {showServerField && (
                <TextInput
                  style={styles.input}
                  value={wsInput}
                  onChangeText={setWsInput}
                  placeholder="ws://192.168.1.10:3001"
                  placeholderTextColor={COLORS.slate}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  discoveredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discoveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  discoveredRowPressed: {
    backgroundColor: COLORS.emeraldSoft,
  },
  discoveredCodePill: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  discoveredCodeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  discoveredHost: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
  },
  discoveredIp: {
    fontSize: 11,
    color: COLORS.inkMuted,
  },
  tapJoinPill: {
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tapJoinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkMuted,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: COLORS.indigo,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.stopRedSoft,
    padding: 12,
    borderRadius: 14,
  },
  errorText: {
    flex: 1,
    color: COLORS.stopRedDark,
    fontSize: 13,
    fontWeight: '600',
  },
  qrSection: {
    gap: 12,
  },
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.indigoSoft,
    borderRadius: 14,
  },
  connectingText: {
    color: COLORS.indigo,
    fontWeight: '700',
    fontSize: 13,
  },
  joinSubmitBtn: {
    marginTop: 4,
    backgroundColor: COLORS.indigo,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  joinSubmitBtnPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  joinSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  advancedToggleText: {
    fontSize: 11,
    color: COLORS.inkMuted,
    fontWeight: '600',
  },
  waitingHero: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    marginTop: 4,
  },
  waitingSub: {
    fontSize: 14,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerChipMe: {
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.emerald,
  },
  playerChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingVertical: 12,
  },
  metaItem: {
    alignItems: 'center',
    gap: 2,
  },
  metaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.ink,
  },
  metaLabel: {
    fontSize: 11,
    color: COLORS.inkMuted,
    fontWeight: '600',
  },
  catPreviewChip: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  catPreviewText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  hintRulePreview: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    backgroundColor: COLORS.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  leaveBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.stopRed,
  },
  leaveBtnText: {
    color: COLORS.stopRed,
    fontSize: 14,
    fontWeight: '800',
  },
});
