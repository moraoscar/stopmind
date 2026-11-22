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
import { useGame } from '../context/GameContext';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SIZES,
  SPACING,
} from '../theme/tokens';
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
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: SIZES.iconBtn,
    height: SIZES.iconBtn,
    borderRadius: SIZES.iconBtn / 2,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
  },
  connectedText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  scrollContent: {
    padding: SPACING.xl,
    gap: SPACING.lg,
    paddingBottom: SPACING.huge + 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  discoveredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  discoveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  discoveredRowPressed: {
    backgroundColor: COLORS.emeraldSoft,
  },
  discoveredCodePill: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.sm,
  },
  discoveredCodeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.wider,
  },
  discoveredHost: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  discoveredIp: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
  },
  tapJoinPill: {
    backgroundColor: COLORS.emerald,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.pill,
  },
  tapJoinText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.inkMuted,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  codeInput: {
    fontSize: FONT_SIZES.h3,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.code,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADII.xl,
    padding: SPACING.xxs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xxs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.base - 1,
    borderRadius: RADII.md,
  },
  tabActive: {
    backgroundColor: COLORS.indigo,
  },
  tabText: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.stopRedSoft,
    padding: SPACING.base,
    borderRadius: RADII.lg,
  },
  errorText: {
    flex: 1,
    color: COLORS.stopRedDark,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  qrSection: {
    gap: SPACING.base,
  },
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.base,
    backgroundColor: COLORS.indigoSoft,
    borderRadius: RADII.lg,
  },
  connectingText: {
    color: COLORS.indigo,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.md,
  },
  joinSubmitBtn: {
    marginTop: SPACING.xxs,
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg + 1,
    borderRadius: RADII.xl,
    alignItems: 'center',
  },
  joinSubmitBtnPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  joinSubmitText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.wide,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingTop: 2,
  },
  advancedToggleText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  waitingHero: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.modal,
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitingTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
    marginTop: SPACING.xxs,
  },
  waitingSub: {
    fontSize: FONT_SIZES.base,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerChipMe: {
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
  },
  onlineDot: {
    width: SIZES.statusDot,
    height: SIZES.statusDot,
    borderRadius: SIZES.statusDot / 2,
    backgroundColor: COLORS.emerald,
  },
  playerChipText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.bg,
    borderRadius: RADII.xl,
    paddingVertical: SPACING.base,
  },
  metaItem: {
    alignItems: 'center',
    gap: 2,
  },
  metaValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  metaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  catPreviewChip: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.base - 1,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
  },
  catPreviewText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  hintRulePreview: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.amberText,
    backgroundColor: COLORS.amberSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.sm,
  },
  leaveBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.stopRed,
  },
  leaveBtnText: {
    color: COLORS.stopRed,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
});
