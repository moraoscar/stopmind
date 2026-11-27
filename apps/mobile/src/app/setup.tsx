import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrInviteModal } from '../components/QrInviteModal';
import { PlayerAvatar } from '../components/PlayerAvatar';
import {
  BONUS_CATEGORIES,
  DEFAULT_CATEGORIES,
  FULL_SPANISH_ALPHABET,
  STOP_ALPHABET,
  TIME_PRESETS,
} from '../constants/game';
import { useGame } from '../context/GameContext';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SHADOWS,
  SIZES,
  SPACING,
} from '../theme/tokens';
import { buildShareableJoinLink, formatSeconds } from '../utils/network';

export default function SetupScreen() {
  const {
    config,
    updateConfig,
    connectionStatus,
    roomMode,
    onlineAvailable,
    isPhoneHost,
    room,
    qrPayload,
    effectiveWsUrl,
    serverUrl,
    setServerUrl,
    createLanRoom,
    createOnlineRoom,
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
              <View style={[styles.cardTitleRow, styles.roundsInfoWrap]}>
                <Ionicons name="repeat" size={18} color={COLORS.emerald} />
                <View style={styles.switchTextWrap}>
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

          {/* 4. Invite Players (WiFi Local / Online) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons
                  name={roomMode === 'online' ? 'globe-outline' : 'people'}
                  size={18}
                  color={COLORS.indigo}
                />
                <Text style={styles.cardTitle}>Invitar jugadores</Text>
              </View>
              <Text style={styles.badgeCount}>
                {playersCount} {playersCount === 1 ? 'jugador' : 'jugadores'}
              </Text>
            </View>

            {/* Mode Switcher: WiFi Local vs Online */}
            <View style={styles.modeSwitchRow}>
              <Pressable
                onPress={() => {
                  clearError();
                  if (roomMode !== 'lan' || connectionStatus !== 'connected') {
                    void createLanRoom();
                  }
                }}
                style={[
                  styles.modeSwitchBtn,
                  roomMode === 'lan' && styles.modeSwitchBtnActive,
                ]}
              >
                <Ionicons
                  name="wifi"
                  size={15}
                  color={roomMode === 'lan' ? COLORS.white : COLORS.ink}
                />
                <Text
                  style={[
                    styles.modeSwitchText,
                    roomMode === 'lan' && styles.modeSwitchTextActive,
                  ]}
                >
                  Wi-Fi local
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  clearError();
                  void createOnlineRoom();
                }}
                style={[
                  styles.modeSwitchBtn,
                  roomMode === 'online' && styles.modeSwitchBtnActive,
                ]}
              >
                <Ionicons
                  name="globe-outline"
                  size={15}
                  color={roomMode === 'online' ? COLORS.white : COLORS.ink}
                />
                <Text
                  style={[
                    styles.modeSwitchText,
                    roomMode === 'online' && styles.modeSwitchTextActive,
                  ]}
                >
                  Online
                </Text>
              </Pressable>
            </View>

            {connectionStatus === 'connected' && room ? (
              <>
                <View style={styles.playersList}>
                  {room.players.map((p) => (
                    <View key={p.id} style={styles.playerPill}>
                      <PlayerAvatar
                        avatarId={p.avatarId}
                        bgId={p.avatarBg}
                        fallbackName={p.name}
                        size={24}
                        ringWidth={1.5}
                      />
                      <Text style={styles.playerPillText}>
                        {p.name}
                        {p.isHost ? ' ★' : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.inviteActionRow}>
                  <Pressable
                    onPress={() => setQrVisible(true)}
                    style={({ pressed }) => [
                      styles.qrButton,
                      styles.flex,
                      pressed && styles.qrButtonPressed,
                    ]}
                  >
                    <Ionicons name="qr-code" size={18} color={COLORS.white} />
                    <Text style={styles.qrButtonText}>
                      QR · Sala {room.roomCode}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const shareLink = buildShareableJoinLink(
                        effectiveWsUrl,
                        room.roomCode,
                        roomMode === 'online'
                      );
                      const msg =
                        roomMode === 'online'
                          ? `¡Únete a mi partida online de STOPMind! 🎯\nCódigo: ${room.roomCode}\n${shareLink}`
                          : `¡Únete a mi partida WiFi de STOPMind! 🎯\nCódigo: ${room.roomCode}\n${shareLink}`;
                      void Share.share({ message: msg });
                    }}
                    style={styles.shareIconBtn}
                    accessibilityLabel="Compartir invitación"
                  >
                    <Ionicons
                      name="share-social-outline"
                      size={20}
                      color={COLORS.indigo}
                    />
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.offlineCard}>
                <Text style={styles.offlineInfo}>
                  {connectionStatus === 'connecting'
                    ? roomMode === 'online'
                      ? 'Creando sala online…'
                      : 'Conectando al servidor WiFi local…'
                    : errorMessage
                      ? errorMessage
                      : !onlineAvailable && roomMode === 'online'
                        ? 'El modo Online no está disponible en este momento. Puedes jugar en Wi-Fi local sin internet.'
                        : 'No se detectó sala activa. Puedes jugar solo o reconectar para invitar jugadores.'}
                </Text>
                <View style={styles.offlineActions}>
                  <Pressable
                    onPress={() =>
                      roomMode === 'online'
                        ? void createOnlineRoom()
                        : handleReconnect()
                    }
                    style={styles.reconnectBtn}
                  >
                    <Ionicons name="refresh" size={16} color={COLORS.indigo} />
                    <Text style={styles.reconnectText}>
                      {roomMode === 'online' ? 'Reintentar Online' : 'Reconectar WiFi'}
                    </Text>
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

            {roomMode === 'online' ? (
              <View style={styles.advancedToggle}>
                <Ionicons
                  name="cloud-done-outline"
                  size={14}
                  color={COLORS.emerald}
                />
                <Text style={styles.advancedToggleText}>
                  Sala Online · Comparte el código con amigos a distancia
                </Text>
              </View>
            ) : isPhoneHost ? (
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
          isOnline={roomMode === 'online'}
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
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: COLORS.emeraldSoft,
    borderColor: COLORS.emeraldBorder,
  },
  statusLocal: {
    backgroundColor: COLORS.amberSoft,
    borderColor: COLORS.amberBorder,
  },
  statusDot: {
    width: SIZES.statusDot,
    height: SIZES.statusDot,
    borderRadius: SIZES.statusDot / 2,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  scrollContent: {
    padding: SPACING.xl,
    gap: SPACING.lg,
    paddingBottom: SPACING.huge,
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.card,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  cardSubSmall: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
  },
  cardHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    marginTop: -SPACING.xxs,
  },
  badgeCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.pill,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.indigo,
    borderColor: COLORS.indigo,
  },
  chipText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  customRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 2,
  },
  customInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.base,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: COLORS.slate,
  },
  letterQuickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  letterQuickBtn: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.sm,
    alignItems: 'center',
  },
  letterQuickText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  lettersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  letterTile: {
    width: 38,
    height: 38,
    borderRadius: RADII.sm + 1,
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
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.inkMuted,
  },
  letterTileTextSelected: {
    color: COLORS.white,
  },
  timeHighlight: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.stopRed,
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  presetBtn: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetBtnActive: {
    backgroundColor: COLORS.stopRed,
    borderColor: COLORS.stopRed,
  },
  presetText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  presetTextActive: {
    color: COLORS.white,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  stepMiniBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs + 1,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  stepMiniText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  stepperNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
  },
  roundsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  roundsInfoWrap: {
    flex: 1,
    minWidth: 0,
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: SPACING.sm,
    backgroundColor: COLORS.bg,
    padding: SPACING.xxs,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: RADII.sm,
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
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
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
    gap: SPACING.base,
  },
  switchTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  switchTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  switchDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  geminiBox: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  geminiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  geminiToggleText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.indigo,
  },
  geminiInputWrap: {
    gap: SPACING.xs,
  },
  geminiHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkMuted,
    lineHeight: 16,
  },
  hintModeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  hintModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADII.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hintModeBtnActive: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  hintModeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  hintModeTextActive: {
    color: COLORS.white,
  },
  hintStepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    padding: SPACING.md,
  },
  hintStepperVal: {
    minWidth: 38,
    textAlign: 'center',
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    padding: SPACING.xxs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xxs,
  },
  modeSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md - 1,
    borderRadius: RADII.sm,
  },
  modeSwitchBtnActive: {
    backgroundColor: COLORS.indigo,
  },
  modeSwitchText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  modeSwitchTextActive: {
    color: COLORS.white,
  },
  inviteActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  shareIconBtn: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    borderRadius: RADII.xl,
    backgroundColor: COLORS.indigoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlineDot: {
    width: SIZES.statusDot,
    height: SIZES.statusDot,
    borderRadius: SIZES.statusDot / 2,
    backgroundColor: COLORS.emerald,
  },
  playerPillText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.indigo,
    paddingVertical: SPACING.lg,
    borderRadius: RADII.xl,
  },
  qrButtonPressed: {
    backgroundColor: COLORS.indigoDark,
  },
  qrButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  offlineCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    padding: SPACING.base,
    gap: SPACING.md,
  },
  offlineInfo: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    lineHeight: 18,
  },
  offlineActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reconnectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.indigoSoft,
    paddingVertical: SPACING.md,
    borderRadius: RADII.md,
  },
  reconnectText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.indigo,
  },
  qrGhostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrGhostText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
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
  serverConfigRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  serverInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md - 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connectMiniBtn: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectMiniText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.stopRed,
    paddingVertical: SPACING.xl,
    borderRadius: RADII.xl + 2,
    ...SHADOWS.stopButtonSm,
  },
  startBtnPressed: {
    backgroundColor: COLORS.stopRedDark,
    transform: [{ scale: 0.99 }],
  },
  startBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.wider,
  },
});
