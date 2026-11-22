import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrInviteModal } from '../components/QrInviteModal';
import {
  BONUS_CATEGORIES,
  COLORS,
  DEFAULT_CATEGORIES,
  FULL_SPANISH_ALPHABET,
  STOP_ALPHABET,
  TIME_PRESETS,
} from '../constants/game';
import { useGame } from '../context/GameContext';
import { formatSeconds } from '../utils/network';

export default function SetupScreen() {
  const {
    config,
    updateConfig,
    connectionStatus,
    isPhoneHost,
    room,
    qrPayload,
    effectiveWsUrl,
    serverUrl,
    setServerUrl,
    createLanRoom,
    startGame,
    leaveGame,
    errorMessage,
    clearError,
  } = useGame();

  const [customCategory, setCustomCategory] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (connectionStatus === 'disconnected') {
      void createLanRoom();
    }
  }, [connectionStatus, createLanRoom]);

  const toggleCategory = (cat: string) => {
    clearError();
    updateConfig((prev) => {
      const exists = prev.categories.includes(cat);
      if (exists) {
        if (prev.categories.length <= 1) return prev;
        return {
          ...prev,
          categories: prev.categories.filter((c) => c !== cat),
        };
      }
      return { ...prev, categories: [...prev.categories, cat] };
    });
  };

  const addCustomCategory = () => {
    const cleaned = customCategory.trim();
    if (!cleaned) return;
    const duplicate = config.categories.some(
      (c) => c.toLowerCase() === cleaned.toLowerCase()
    );
    if (!duplicate) {
      updateConfig((prev) => ({
        ...prev,
        categories: [...prev.categories, cleaned],
      }));
    }
    setCustomCategory('');
  };

  const adjustTime = (delta: number) => {
    updateConfig((prev) => ({
      ...prev,
      timeLimitSeconds: Math.max(15, Math.min(300, prev.timeLimitSeconds + delta)),
    }));
  };

  const adjustRounds = (delta: number) => {
    updateConfig((prev) => ({
      ...prev,
      totalRounds: Math.max(1, Math.min(15, prev.totalRounds + delta)),
    }));
  };

  const adjustHintPoints = (delta: number) => {
    updateConfig((prev) => ({
      ...prev,
      hintPenaltyPoints: Math.max(5, Math.min(100, prev.hintPenaltyPoints + delta)),
    }));
  };

  const adjustHintLock = (delta: number) => {
    updateConfig((prev) => ({
      ...prev,
      hintLockSeconds: Math.max(3, Math.min(60, prev.hintLockSeconds + delta)),
    }));
  };

  const toggleLetter = (letter: string) => {
    clearError();
    updateConfig((prev) => {
      const exists = prev.allowedLetters.includes(letter);
      if (exists) {
        if (prev.allowedLetters.length <= 1) return prev;
        return {
          ...prev,
          allowedLetters: prev.allowedLetters.filter((l) => l !== letter),
        };
      }
      return {
        ...prev,
        allowedLetters: [...prev.allowedLetters, letter],
      };
    });
  };

  const handleReconnect = () => {
    setServerUrl(serverInput);
    void createLanRoom(serverInput);
  };

  // Show all defaults + any custom categories added by the user
  const customAdded = config.categories.filter(
    (c) => !DEFAULT_CATEGORIES.includes(c) && !BONUS_CATEGORIES.includes(c)
  );
  const allCategoryOptions = [
    ...DEFAULT_CATEGORIES,
    ...BONUS_CATEGORIES,
    ...customAdded,
  ];

  const playersCount = room?.players.length ?? 1;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={styles.header}>
          <Pressable
            onPress={leaveGame}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.ink} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Configurar Partida</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              connectionStatus === 'connected'
                ? styles.statusOnline
                : styles.statusLocal,
            ]}
          >
            {connectionStatus === 'connecting' ? (
              <ActivityIndicator size="small" color={COLORS.indigo} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      connectionStatus === 'connected'
                        ? COLORS.emerald
                        : COLORS.amber,
                  },
                ]}
              />
            )}
            <Text style={styles.statusText}>
              {connectionStatus === 'connected'
                ? `Sala ${room?.roomCode}`
                : connectionStatus === 'connecting'
                  ? 'WiFi…'
                  : 'Local'}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={COLORS.stopRedDark} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* 1. Categories */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="grid" size={18} color={COLORS.indigo} />
                <Text style={styles.cardTitle}>Categorías</Text>
              </View>
              <Text style={styles.badgeCount}>
                {config.categories.length} seleccionadas
              </Text>
            </View>
            <Text style={styles.cardHint}>
              Toca para activar o quitar las categorías de cada ronda.
            </Text>

            <View style={styles.chipsWrap}>
              {allCategoryOptions.map((cat) => {
                const selected = config.categories.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={16}
                      color={selected ? '#FFFFFF' : COLORS.inkMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom category input */}
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Agregar otra categoría…"
                placeholderTextColor={COLORS.slate}
                maxLength={24}
                returnKeyType="done"
                onSubmitEditing={addCustomCategory}
              />
              <Pressable
                onPress={addCustomCategory}
                style={[
                  styles.addBtn,
                  !customCategory.trim() && styles.addBtnDisabled,
                ]}
                disabled={!customCategory.trim()}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* 1.5 Letters selector */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="text" size={18} color={COLORS.indigo} />
                <Text style={styles.cardTitle}>Letras de la partida</Text>
              </View>
              <Text style={styles.badgeCount}>
                {config.allowedLetters.length} activas
              </Text>
            </View>
            <Text style={styles.cardHint}>
              Elige con qué letras quieres jugar. Se rotan sin repetirse entre
              rondas y partidas seguidas.
            </Text>

            <View style={styles.letterQuickRow}>
              <Pressable
                onPress={() => updateConfig({ allowedLetters: [...STOP_ALPHABET] })}
                style={styles.letterQuickBtn}
              >
                <Text style={styles.letterQuickText}>Clásicas (21)</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  updateConfig({ allowedLetters: [...FULL_SPANISH_ALPHABET] })
                }
                style={styles.letterQuickBtn}
              >
                <Text style={styles.letterQuickText}>Todas (27)</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  updateConfig({ allowedLetters: ['A', 'C', 'M', 'P', 'S'] })
                }
                style={styles.letterQuickBtn}
              >
                <Text style={styles.letterQuickText}>Fáciles (5)</Text>
              </Pressable>
            </View>

            <View style={styles.lettersGrid}>
              {FULL_SPANISH_ALPHABET.map((letter) => {
                const selected = config.allowedLetters.includes(letter);
                return (
                  <Pressable
                    key={letter}
                    onPress={() => toggleLetter(letter)}
                    style={[
                      styles.letterTile,
                      selected && styles.letterTileSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.letterTileText,
                        selected && styles.letterTileTextSelected,
                      ]}
                    >
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 2. Time Limit */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="timer" size={18} color={COLORS.stopRed} />
                <Text style={styles.cardTitle}>Tiempo límite por ronda</Text>
              </View>
              <Text style={styles.timeHighlight}>
                {formatSeconds(config.timeLimitSeconds)}
              </Text>
            </View>

            <View style={styles.presetsRow}>
              {TIME_PRESETS.map((preset) => {
                const active = config.timeLimitSeconds === preset.seconds;
                return (
                  <Pressable
                    key={preset.seconds}
                    onPress={() =>
                      updateConfig({ timeLimitSeconds: preset.seconds })
                    }
                    style={[styles.presetBtn, active && styles.presetBtnActive]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        active && styles.presetTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={() => adjustTime(-15)}
                style={styles.stepMiniBtn}
              >
                <Text style={styles.stepMiniText}>−15s</Text>
              </Pressable>
              <Text style={styles.stepperNote}>Por defecto: 1 minuto</Text>
              <Pressable
                onPress={() => adjustTime(15)}
                style={styles.stepMiniBtn}
              >
                <Text style={styles.stepMiniText}>+15s</Text>
              </Pressable>
            </View>
          </View>

          {/* 3. Rounds + Letter Validation */}
          <View style={styles.card}>
            <View style={styles.roundsRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="repeat" size={18} color={COLORS.emerald} />
                <View>
                  <Text style={styles.cardTitle}>Cantidad de rondas</Text>
                  <Text style={styles.cardSubSmall}>
                    Cada ronda sortea una letra diferente
                  </Text>
                </View>
              </View>

              <View style={styles.counterBox}>
                <Pressable
                  onPress={() => adjustRounds(-1)}
                  style={[
                    styles.counterBtn,
                    config.totalRounds <= 1 && styles.counterBtnDisabled,
                  ]}
                  disabled={config.totalRounds <= 1}
                >
                  <Ionicons name="remove" size={18} color={COLORS.ink} />
                </Pressable>
                <Text style={styles.counterValue}>{config.totalRounds}</Text>
                <Pressable
                  onPress={() => adjustRounds(1)}
                  style={[
                    styles.counterBtn,
                    config.totalRounds >= 15 && styles.counterBtnDisabled,
                  ]}
                  disabled={config.totalRounds >= 15}
                >
                  <Ionicons name="add" size={18} color={COLORS.ink} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Exigir letra de la ronda</Text>
                <Text style={styles.switchDesc}>
                  Las palabras deben empezar por la letra sorteada para sumar
                  puntos.
                </Text>
              </View>
              <Switch
                value={config.validateLetter}
                onValueChange={(val) => updateConfig({ validateLetter: val })}
                trackColor={{ false: COLORS.border, true: COLORS.indigo }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>
                  Revisión inteligente de palabras
                </Text>
                <Text style={styles.switchDesc}>
                  Valida que cada palabra sea real y corresponda a su categoría
                  (sin exigir tildes). Si no hay conexión, usa el filtro local
                  automático.
                </Text>
              </View>
              <Switch
                value={config.aiValidation}
                onValueChange={(val) => updateConfig({ aiValidation: val })}
                trackColor={{ false: COLORS.border, true: COLORS.indigo }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* 3.5 Hint Button & Penalty Settings */}
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={[styles.cardTitleRow, styles.flex]}>
                <Ionicons name="bulb" size={18} color={COLORS.amber} />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.cardTitle}>Botón de ayuda</Text>
                  <Text style={styles.cardSubSmall}>
                    Sugiere una palabra con penalización configurable
                  </Text>
                </View>
              </View>
              <Switch
                value={config.hintsEnabled}
                onValueChange={(val) => updateConfig({ hintsEnabled: val })}
                trackColor={{ false: COLORS.border, true: COLORS.amber }}
                thumbColor="#FFFFFF"
              />
            </View>

            {config.hintsEnabled && (
              <>
                <View style={styles.divider} />
                <Text style={styles.cardHint}>
                  Elige qué penalización se aplica al usar una ayuda:
                </Text>

                <View style={styles.hintModeRow}>
                  {(
                    [
                      { key: 'points', label: 'Restar puntos', icon: 'remove-circle-outline' },
                      { key: 'lock', label: 'Bloqueo', icon: 'lock-closed-outline' },
                      { key: 'both', label: 'Ambas', icon: 'warning-outline' },
                    ] as const
                  ).map((opt) => {
                    const active = config.hintPenaltyMode === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => updateConfig({ hintPenaltyMode: opt.key })}
                        style={[
                          styles.hintModeBtn,
                          active && styles.hintModeBtnActive,
                        ]}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={15}
                          color={active ? '#FFFFFF' : COLORS.ink}
                        />
                        <Text
                          style={[
                            styles.hintModeText,
                            active && styles.hintModeTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {(config.hintPenaltyMode === 'points' ||
                  config.hintPenaltyMode === 'both') && (
                  <View style={styles.hintStepperCard}>
                    <View style={styles.switchTextWrap}>
                      <Text style={styles.switchTitle}>Puntos de penalización</Text>
                      <Text style={styles.switchDesc}>
                        Se descuentan por cada ayuda usada en la ronda
                      </Text>
                    </View>
                    <View style={styles.counterBox}>
                      <Pressable
                        onPress={() => adjustHintPoints(-5)}
                        style={[
                          styles.counterBtn,
                          config.hintPenaltyPoints <= 5 &&
                            styles.counterBtnDisabled,
                        ]}
                        disabled={config.hintPenaltyPoints <= 5}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.ink} />
                      </Pressable>
                      <Text style={styles.hintStepperVal}>
                        −{config.hintPenaltyPoints}
                      </Text>
                      <Pressable
                        onPress={() => adjustHintPoints(5)}
                        style={[
                          styles.counterBtn,
                          config.hintPenaltyPoints >= 100 &&
                            styles.counterBtnDisabled,
                        ]}
                        disabled={config.hintPenaltyPoints >= 100}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </Pressable>
                    </View>
                  </View>
                )}

                {(config.hintPenaltyMode === 'lock' ||
                  config.hintPenaltyMode === 'both') && (
                  <View style={styles.hintStepperCard}>
                    <View style={styles.switchTextWrap}>
                      <Text style={styles.switchTitle}>Tiempo de bloqueo</Text>
                      <Text style={styles.switchDesc}>
                        Segundos bloqueado antes de seguir o avanzar de categoría
                      </Text>
                    </View>
                    <View style={styles.counterBox}>
                      <Pressable
                        onPress={() => adjustHintLock(-5)}
                        style={[
                          styles.counterBtn,
                          config.hintLockSeconds <= 3 &&
                            styles.counterBtnDisabled,
                        ]}
                        disabled={config.hintLockSeconds <= 3}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.ink} />
                      </Pressable>
                      <Text style={styles.hintStepperVal}>
                        {config.hintLockSeconds}s
                      </Text>
                      <Pressable
                        onPress={() => adjustHintLock(5)}
                        style={[
                          styles.counterBtn,
                          config.hintLockSeconds >= 60 &&
                            styles.counterBtnDisabled,
                        ]}
                        disabled={config.hintLockSeconds >= 60}
                      >
                        <Ionicons name="add" size={16} color={COLORS.ink} />
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* 4. Invite Players (WiFi QR) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="people" size={18} color={COLORS.indigo} />
                <Text style={styles.cardTitle}>Invitar jugadores (WiFi)</Text>
              </View>
              <Text style={styles.badgeCount}>
                {playersCount} {playersCount === 1 ? 'jugador' : 'jugadores'}
              </Text>
            </View>

            {connectionStatus === 'connected' && room ? (
              <>
                <View style={styles.playersList}>
                  {room.players.map((p) => (
                    <View key={p.id} style={styles.playerPill}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.playerPillText}>
                        {p.name}
                        {p.isHost ? ' ★' : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => setQrVisible(true)}
                  style={({ pressed }) => [
                    styles.qrButton,
                    pressed && styles.qrButtonPressed,
                  ]}
                >
                  <Ionicons name="qr-code" size={20} color="#FFFFFF" />
                  <Text style={styles.qrButtonText}>
                    Mostrar QR de invitación (Sala {room.roomCode})
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.offlineCard}>
                <Text style={styles.offlineInfo}>
                  {connectionStatus === 'connecting'
                    ? 'Conectando al servidor WiFi local…'
                    : 'No se detectó el servidor WiFi local. Puedes jugar solo o iniciar el servidor con "npm run server" para invitar con QR.'}
                </Text>
                <View style={styles.offlineActions}>
                  <Pressable
                    onPress={handleReconnect}
                    style={styles.reconnectBtn}
                  >
                    <Ionicons name="refresh" size={16} color={COLORS.indigo} />
                    <Text style={styles.reconnectText}>Reconectar WiFi</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setQrVisible(true)}
                    style={styles.qrGhostBtn}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={16}
                      color={COLORS.ink}
                    />
                    <Text style={styles.qrGhostText}>Ver ayuda QR</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {isPhoneHost ? (
              <View style={styles.advancedToggle}>
                <Ionicons name="phone-portrait-outline" size={14} color={COLORS.emerald} />
                <Text style={styles.advancedToggleText}>
                  Tu teléfono aloja la partida · {effectiveWsUrl}
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    setServerInput(serverUrl);
                    setShowNetworkConfig((v) => !v);
                  }}
                  style={styles.advancedToggle}
                >
                  <Ionicons name="wifi-outline" size={14} color={COLORS.inkMuted} />
                  <Text style={styles.advancedToggleText}>
                    {showNetworkConfig
                      ? 'Ocultar dirección WiFi'
                      : `Servidor WiFi: ${effectiveWsUrl}`}
                  </Text>
                </Pressable>

                {showNetworkConfig && (
                  <View style={styles.serverConfigRow}>
                    <TextInput
                      style={styles.serverInput}
                      value={serverInput}
                      onChangeText={setServerInput}
                      placeholder="ws://192.168.1.10:3001"
                      placeholderTextColor={COLORS.slate}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable onPress={handleReconnect} style={styles.connectMiniBtn}>
                      <Text style={styles.connectMiniText}>Conectar</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* Bottom Play Button */}
        <View style={styles.footer}>
          <Pressable
            onPress={startGame}
            style={({ pressed }) => [
              styles.startBtn,
              pressed && styles.startBtnPressed,
            ]}
          >
            <Ionicons name="play-circle" size={24} color="#FFFFFF" />
            <Text style={styles.startBtnText}>
              {playersCount > 1
                ? `JUGAR (${playersCount} JUGADORES)`
                : 'JUGAR'}
            </Text>
          </Pressable>
        </View>

        <QrInviteModal
          visible={qrVisible}
          onClose={() => setQrVisible(false)}
          qrPayload={qrPayload}
          roomCode={room?.roomCode ?? null}
          wsUrl={effectiveWsUrl}
          players={room?.players ?? []}
        />
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
    backgroundColor: COLORS.bg,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: COLORS.emeraldSoft,
    borderColor: '#A7F3D0',
  },
  statusLocal: {
    backgroundColor: COLORS.amberSoft,
    borderColor: '#FDE68A',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  cardSubSmall: {
    fontSize: 12,
    color: COLORS.inkMuted,
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.inkMuted,
    marginTop: -4,
  },
  badgeCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.indigo,
    borderColor: COLORS.indigo,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  customRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  customInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: COLORS.slate,
  },
  letterQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  letterQuickBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  letterQuickText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  lettersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  letterTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterTileSelected: {
    backgroundColor: COLORS.indigo,
    borderColor: COLORS.indigo,
  },
  letterTileText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.inkMuted,
  },
  letterTileTextSelected: {
    color: '#FFFFFF',
  },
  timeHighlight: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.stopRed,
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetBtnActive: {
    backgroundColor: COLORS.stopRed,
    borderColor: COLORS.stopRed,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stepMiniBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
  },
  stepMiniText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
  },
  stepperNote: {
    fontSize: 12,
    color: COLORS.inkMuted,
  },
  roundsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bg,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.4,
  },
  counterValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.ink,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  switchDesc: {
    fontSize: 12,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  geminiBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  geminiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  geminiToggleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.indigo,
  },
  geminiInputWrap: {
    gap: 6,
  },
  geminiHint: {
    fontSize: 11,
    color: COLORS.inkMuted,
    lineHeight: 16,
  },
  hintModeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  hintModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hintModeBtnActive: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  hintModeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.ink,
  },
  hintModeTextActive: {
    color: '#FFFFFF',
  },
  hintStepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 10,
  },
  hintStepperVal: {
    minWidth: 38,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.emerald,
  },
  playerPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.indigo,
    paddingVertical: 14,
    borderRadius: 16,
  },
  qrButtonPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  qrButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  offlineCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  offlineInfo: {
    fontSize: 12,
    color: COLORS.inkMuted,
    lineHeight: 18,
  },
  offlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reconnectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.indigoSoft,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reconnectText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.indigo,
  },
  qrGhostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
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
  serverConfigRow: {
    flexDirection: 'row',
    gap: 8,
  },
  serverInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connectMiniBtn: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectMiniText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.stopRed,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startBtnPressed: {
    backgroundColor: COLORS.stopRedDark,
    transform: [{ scale: 0.99 }],
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
