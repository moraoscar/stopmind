import React, { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { startsWithLetter } from '@stopmind/shared';
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
import { formatSeconds } from '../utils/network';

export default function PlayScreen() {
  const {
    config,
    room,
    isHost,
    currentRound,
    totalRounds,
    currentLetter,
    roundEndsAt,
    isRoundLocked,
    stopBanner,
    answers,
    hintsUsed,
    setAnswer,
    requestHint,
    pressStop,
    triggerLocalTimeout,
    finishGame,
    leaveGame,
  } = useGame();

  const activeConfig = room?.config ?? config;
  const categories = useMemo(
    () => activeConfig.categories,
    [activeConfig.categories]
  );
  const validateLetter = activeConfig.validateLetter;

  const roundKey = `${currentRound}-${currentLetter}`;
  const [selection, setSelection] = useState({ roundKey, index: 0 });
  const activeIndex = selection.roundKey === roundKey ? selection.index : 0;
  const setActiveIndex = (index: number) => setSelection({ roundKey, index });
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    roundEndsAt ? Math.max(0, (roundEndsAt - Date.now()) / 1000) : config.timeLimitSeconds
  );
  const [hintLockState, setHintLockState] = useState({
    roundKey,
    endsAt: 0,
  });
  const hintLockEndsAt =
    hintLockState.roundKey === roundKey ? hintLockState.endsAt : 0;
  const [rawHintLockRemaining, setRawHintLockRemaining] = useState(0);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintNotice, setHintNotice] = useState<string | null>(null);

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const timeoutTriggeredRef = useRef(false);

  // Focus input at the start of every round
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(focusTimer);
  }, [currentRound, currentLetter]);

  // Dismiss keyboard immediately when round is locked (STOP or timeout)
  useEffect(() => {
    if (isRoundLocked) {
      Keyboard.dismiss();
    }
  }, [isRoundLocked]);

  // Synchronized countdown timer
  useEffect(() => {
    if (!roundEndsAt || isRoundLocked) return;
    timeoutTriggeredRef.current = false;

    const tick = () => {
      const diffSec = Math.max(0, (roundEndsAt - Date.now()) / 1000);
      setRemainingSeconds(diffSec);
      if (diffSec <= 0 && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        triggerLocalTimeout();
      }
    };

    tick();
    const interval = setInterval(tick, 150);
    return () => clearInterval(interval);
  }, [roundEndsAt, isRoundLocked, triggerLocalTimeout]);

  // Hint lock cooldown timer
  useEffect(() => {
    if (!hintLockEndsAt || isRoundLocked) {
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((hintLockEndsAt - Date.now()) / 1000));
      setRawHintLockRemaining(left);
      if (left <= 0) {
        setHintLockState({ roundKey, endsAt: 0 });
      }
    };

    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [hintLockEndsAt, isRoundLocked, roundKey]);

  const hintLockRemaining =
    hintLockEndsAt && !isRoundLocked ? rawHintLockRemaining : 0;
  const isHintLocked = hintLockRemaining > 0 && !isRoundLocked;
  const isInputBlocked = isRoundLocked || isHintLocked;

  const safeIndex = Math.min(activeIndex, Math.max(0, categories.length - 1));
  const activeCategory = categories[safeIndex] ?? '';
  const activeValue = answers[activeCategory] ?? '';

  // Count filled categories
  const filledCount = useMemo(
    () =>
      categories.filter((cat) => (answers[cat] ?? '').trim().length > 0).length,
    [categories, answers]
  );

  // Find next unfilled category OTHER than the currently selected one
  const nextUnfilledIndex = useMemo(() => {
    for (let offset = 1; offset < categories.length; offset++) {
      const idx = (safeIndex + offset) % categories.length;
      if (!(answers[categories[idx]] ?? '').trim()) {
        return idx;
      }
    }
    return -1;
  }, [categories, answers, safeIndex]);

  // If no other categories are missing (this is the last remaining category or all are filled),
  // the action button becomes STOP and locks everyone out!
  const isFinalCategoryStep = nextUnfilledIndex === -1;

  const handleSelectCategory = (idx: number) => {
    if (isInputBlocked) return;
    setActiveIndex(idx);
    inputRef.current?.focus();
  };

  const handlePrimaryAction = () => {
    if (isInputBlocked) return;
    if (!isFinalCategoryStep && nextUnfilledIndex !== -1) {
      setActiveIndex(nextUnfilledIndex);
      scrollRef.current?.scrollTo({
        y: Math.max(0, nextUnfilledIndex * 66 - 60),
        animated: true,
      });
      inputRef.current?.focus();
    } else {
      pressStop();
    }
  };

  const handleClearInput = () => {
    if (isInputBlocked) return;
    setAnswer(activeCategory, '');
    inputRef.current?.focus();
  };

  const handleUseHint = async () => {
    if (isInputBlocked || hintBusy || !activeConfig.hintsEnabled) return;
    setHintBusy(true);
    setHintNotice(null);
    try {
      const res = await requestHint(activeCategory);
      if (!res.word) {
        setHintNotice('No hay sugerencia offline para esta categoría.');
        setTimeout(() => setHintNotice(null), 2200);
        return;
      }
      if (res.lockSeconds > 0) {
        Keyboard.dismiss();
        setRawHintLockRemaining(res.lockSeconds);
        setHintLockState({
          roundKey,
          endsAt: Date.now() + res.lockSeconds * 1000,
        });
      }
      if (res.pointsPenalty > 0) {
        setHintNotice(`Ayuda aplicada (−${res.pointsPenalty} pts)`);
        setTimeout(() => setHintNotice(null), 2400);
      }
    } finally {
      setHintBusy(false);
    }
  };

  const hintBadgeLabel = useMemo(() => {
    if (activeConfig.hintPenaltyMode === 'points') {
      return `−${activeConfig.hintPenaltyPoints} pts`;
    }
    if (activeConfig.hintPenaltyMode === 'lock') {
      return `${activeConfig.hintLockSeconds}s`;
    }
    return `−${activeConfig.hintPenaltyPoints}p · ${activeConfig.hintLockSeconds}s`;
  }, [
    activeConfig.hintPenaltyMode,
    activeConfig.hintPenaltyPoints,
    activeConfig.hintLockSeconds,
  ]);

  const isUrgent = remainingSeconds <= 10;
  const isWarning = remainingSeconds > 10 && remainingSeconds <= 20;

  const activeWrongLetter =
    validateLetter &&
    activeValue.trim().length > 0 &&
    !startsWithLetter(activeValue, currentLetter);

  const roundsPlayedBefore = Math.max(0, currentRound - 1);

  const handleEarlyExit = () => {
    if (isRoundLocked) return;
    Keyboard.dismiss();

    if (isHost) {
      const title = '¿Finalizar partida?';
      const message =
        roundsPlayedBefore > 0
          ? 'La ronda actual se cerrará y verás los resultados finales con los puntos acumulados hasta ahora.'
          : 'Se cerrará la partida actual para ver el resumen y elegir si iniciar un nuevo juego o volver al inicio.';
      if (Platform.OS === 'web') {
        const ok =
          typeof window !== 'undefined' && typeof window.confirm === 'function'
            ? window.confirm(`${title}\n\n${message}`)
            : true;
        if (ok) finishGame();
        return;
      }
      Alert.alert(title, message, [
        { text: 'Seguir jugando', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: finishGame },
      ]);
      return;
    }

    const title = '¿Salir de la partida?';
    const message = 'Saldrás de la sala y volverás a la pantalla de inicio.';
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(`${title}\n\n${message}`)
          : true;
      if (ok) leaveGame();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Seguir jugando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: leaveGame },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {/* TOP HUD: Exit/Finish, Timer, Rounds Progress, Round Letter */}
        <View style={styles.hud}>
          <View style={styles.hudLeft}>
            <Pressable
              onPress={handleEarlyExit}
              disabled={isRoundLocked}
              hitSlop={6}
              accessibilityLabel={
                isHost ? 'Finalizar partida' : 'Salir de la partida'
              }
              style={({ pressed }) => [
                styles.exitBtn,
                pressed && styles.exitBtnPressed,
                isRoundLocked && styles.exitBtnDisabled,
              ]}
            >
              <Ionicons
                name={isHost ? 'flag-outline' : 'exit-outline'}
                size={18}
                color={COLORS.inkMuted}
              />
            </Pressable>

            <View
              style={[
                styles.timerBox,
                isWarning && styles.timerWarning,
                isUrgent && styles.timerUrgent,
              ]}
            >
              <Ionicons
                name="time"
                size={18}
                color={isUrgent ? '#FFFFFF' : isWarning ? '#92400E' : COLORS.ink}
              />
              <Text
                style={[
                  styles.timerText,
                  isWarning && styles.timerTextWarning,
                  isUrgent && styles.timerTextUrgent,
                ]}
              >
                {formatSeconds(remainingSeconds)}
              </Text>
            </View>

            <View style={styles.roundsInfo}>
              <Text style={styles.roundPrimary}>
                Ronda {currentRound} de {totalRounds}
              </Text>
              <Text style={styles.roundSecondary}>
                {roundsPlayedBefore === 0
                  ? 'Primera ronda'
                  : `${roundsPlayedBefore} ${roundsPlayedBefore === 1 ? 'jugada' : 'jugadas'}`}
                {room && room.players.length > 1
                  ? ` · ${room.players.length} jugadores`
                  : ''}
              </Text>
            </View>
          </View>

          <View style={styles.letterBadge}>
            <Text style={styles.letterLabel}>LETRA</Text>
            <Text style={styles.letterValue}>{currentLetter || '—'}</Text>
          </View>
        </View>

        {/* Progress Strip */}
        <View style={styles.progressBarWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${categories.length > 0 ? (filledCount / categories.length) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {filledCount}/{categories.length}
          </Text>
        </View>

        {/* MIDDLE: Interactive Categories List (click any category to edit directly) */}
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {categories.map((cat, idx) => {
            const val = answers[cat] ?? '';
            const trimmed = val.trim();
            const isSelected = idx === safeIndex;
            const wrongLetter =
              validateLetter &&
              trimmed.length > 0 &&
              !startsWithLetter(trimmed, currentLetter);

            return (
              <Pressable
                key={cat}
                onPress={() => handleSelectCategory(idx)}
                disabled={isInputBlocked}
                style={[
                  styles.catRow,
                  isSelected && styles.catRowActive,
                  trimmed.length > 0 && !isSelected && styles.catRowFilled,
                  isHintLocked && !isSelected && styles.catRowDimmed,
                ]}
              >
                <View
                  style={[
                    styles.catIndex,
                    isSelected && styles.catIndexActive,
                    trimmed.length > 0 && !isSelected && styles.catIndexFilled,
                  ]}
                >
                  {trimmed.length > 0 && !wrongLetter ? (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={isSelected ? COLORS.indigo : '#FFFFFF'}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.catIndexText,
                        isSelected && styles.catIndexTextActive,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                <View style={styles.catContent}>
                  <Text
                    style={[
                      styles.catName,
                      isSelected && styles.catNameActive,
                    ]}
                  >
                    {cat}
                  </Text>
                  <Text
                    style={[
                      styles.catValue,
                      !trimmed && styles.catPlaceholder,
                      wrongLetter && styles.catWrongLetter,
                    ]}
                    numberOfLines={1}
                  >
                    {trimmed || 'Toca para ingresar palabra…'}
                  </Text>
                </View>

                {wrongLetter ? (
                  <View style={styles.warnBadge}>
                    <Text style={styles.warnBadgeText}>
                      No es {currentLetter}
                    </Text>
                  </View>
                ) : isSelected ? (
                  <View style={styles.editingPill}>
                    <Text style={styles.editingPillText}>Activa</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* BOTTOM DOCK: Active Category Input + Hint + Quick Clear + SIGUIENTE / STOP */}
        <View style={styles.inputDock}>
          {isHintLocked ? (
            <View style={styles.lockBanner}>
              <Ionicons name="lock-closed" size={16} color="#92400E" />
              <Text style={styles.lockBannerText}>
                Bloqueado por ayuda · espera {hintLockRemaining}s para continuar
              </Text>
            </View>
          ) : hintNotice ? (
            <View style={styles.hintToast}>
              <Ionicons name="bulb" size={15} color="#92400E" />
              <Text style={styles.hintToastText}>{hintNotice}</Text>
            </View>
          ) : null}

          <View style={styles.dockHeader}>
            <View style={styles.dockTitleGroup}>
              <Text style={styles.dockCategoryLabel} numberOfLines={1}>
                {safeIndex + 1}. {activeCategory}
              </Text>
              {validateLetter && currentLetter ? (
                <Text
                  style={[
                    styles.dockHint,
                    activeWrongLetter && styles.dockHintWarn,
                  ]}
                >
                  {activeWrongLetter
                    ? `Debe empezar con "${currentLetter}"`
                    : `Letra "${currentLetter}"`}
                </Text>
              ) : null}
            </View>

            {activeConfig.hintsEnabled && (
              <Pressable
                onPress={() => void handleUseHint()}
                disabled={isInputBlocked || hintBusy}
                style={({ pressed }) => [
                  styles.helpBtn,
                  pressed && styles.helpBtnPressed,
                  (isInputBlocked || hintBusy) && styles.helpBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pedir ayuda"
              >
                <Ionicons name="bulb" size={14} color="#92400E" />
                <Text style={styles.helpBtnText}>
                  Ayuda ({hintBadgeLabel})
                </Text>
                {hintsUsed > 0 && (
                  <View style={styles.helpCountPill}>
                    <Text style={styles.helpCountText}>{hintsUsed}</Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>

          <View style={styles.inputRow}>
            <View
              style={[
                styles.inputBox,
                activeWrongLetter && styles.inputBoxWarn,
                isInputBlocked && styles.inputBoxLocked,
              ]}
            >
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={activeValue}
                onChangeText={(text) => setAnswer(activeCategory, text)}
                placeholder={`Escribe un(a) ${activeCategory.toLowerCase()}…`}
                placeholderTextColor={COLORS.slate}
                editable={!isInputBlocked}
                autoCapitalize="sentences"
                autoCorrect={false}
                returnKeyType={isFinalCategoryStep ? 'done' : 'next'}
                blurOnSubmit={false}
                onSubmitEditing={handlePrimaryAction}
              />

              {/* Quick Clear Button */}
              {activeValue.length > 0 && !isInputBlocked && (
                <Pressable
                  onPress={handleClearInput}
                  style={styles.clearBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Borrar texto"
                >
                  <Ionicons name="close-circle" size={22} color={COLORS.inkMuted} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={handlePrimaryAction}
              disabled={isInputBlocked}
              style={({ pressed }) => [
                styles.actionBtn,
                isFinalCategoryStep ? styles.stopBtn : styles.nextBtn,
                pressed && styles.actionBtnPressed,
                isInputBlocked && styles.actionBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFinalCategoryStep ? 'STOP' : 'Siguiente'}
            >
              {isHintLocked ? (
                <>
                  <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{hintLockRemaining}s</Text>
                </>
              ) : isFinalCategoryStep ? (
                <>
                  <Ionicons name="hand-left" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>STOP</Text>
                </>
              ) : (
                <>
                  <Text style={styles.actionBtnText}>SIGUIENTE</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Locked / STOP Overlay Banner */}
        {isRoundLocked && stopBanner && (
          <View style={styles.stopOverlay}>
            <View style={styles.stopCard}>
              <View style={styles.stopIconCircle}>
                <Ionicons
                  name={stopBanner.reason === 'stop' ? 'hand-left' : 'alarm'}
                  size={40}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.stopHeadline}>
                {stopBanner.reason === 'stop' ? '¡STOP!' : '¡TIEMPO AGOTADO!'}
              </Text>
              <Text style={styles.stopMessage}>
                {stopBanner.reason === 'stop' && stopBanner.stoppedByName
                  ? `${stopBanner.stoppedByName} detuvo la ronda.`
                  : 'Se acabó el tiempo de la ronda.'}
              </Text>
              <Text style={styles.stopSub}>
                Inputs bloqueados · Revisando palabras y calculando puntos…
              </Text>
            </View>
          </View>
        )}
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
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnPressed: {
    opacity: 0.7,
  },
  exitBtnDisabled: {
    opacity: 0.4,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timerWarning: {
    backgroundColor: COLORS.amberSoft,
    borderColor: COLORS.amber,
  },
  timerUrgent: {
    backgroundColor: COLORS.stopRed,
    borderColor: COLORS.stopRedDark,
  },
  timerText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: COLORS.amberText,
  },
  timerTextUrgent: {
    color: COLORS.white,
  },
  roundsInfo: {
    flex: 1,
  },
  roundPrimary: {
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  },
  roundSecondary: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  letterBadge: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.xl,
    alignItems: 'center',
    minWidth: 62,
  },
  letterLabel: {
    fontSize: FONT_SIZES.micro,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.indigoBorder,
    letterSpacing: LETTER_SPACING.wide,
  },
  letterValue: {
    fontSize: FONT_SIZES.h2,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.white,
    lineHeight: 27,
  },
  progressBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.emerald,
    borderRadius: 3,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.xl,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base - 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catRowActive: {
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
  },
  catRowFilled: {
    borderColor: COLORS.emeraldBorder,
  },
  catRowDimmed: {
    opacity: 0.55,
  },
  catIndex: {
    width: 28,
    height: 28,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIndexActive: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.indigo,
  },
  catIndexFilled: {
    backgroundColor: COLORS.emerald,
  },
  catIndexText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.inkMuted,
  },
  catIndexTextActive: {
    color: COLORS.indigo,
  },
  catContent: {
    flex: 1,
  },
  catName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  catNameActive: {
    color: COLORS.indigo,
  },
  catValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
    marginTop: 1,
  },
  catPlaceholder: {
    color: COLORS.slate,
    fontWeight: FONT_WEIGHTS.regular,
    fontSize: FONT_SIZES.base,
  },
  catWrongLetter: {
    color: COLORS.amberDark,
  },
  editingPill: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: SPACING.md - 1,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.pill,
  },
  editingPillText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  warnBadge: {
    backgroundColor: COLORS.amberSoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.xs,
  },
  warnBadgeText: {
    color: COLORS.amberText,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  inputDock: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  dockTitleGroup: {
    flex: 1,
    gap: 1,
  },
  dockCategoryLabel: {
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.ink,
  },
  dockHint: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.indigo,
  },
  dockHintWarn: {
    color: COLORS.amberDark,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADII.pill,
  },
  helpBtnPressed: {
    transform: [{ scale: 0.96 }],
  },
  helpBtnDisabled: {
    opacity: 0.45,
  },
  helpBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.amberText,
  },
  helpCountPill: {
    backgroundColor: COLORS.amberText,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxs,
  },
  helpCountText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xxs,
    fontWeight: FONT_WEIGHTS.black,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.amberSoft,
    borderRadius: RADII.md,
    paddingVertical: SPACING.xs + 1,
    paddingHorizontal: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  lockBannerText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.amberText,
  },
  hintToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.amberSoft,
    borderRadius: RADII.sm,
    paddingVertical: SPACING.xxs + 1,
    paddingHorizontal: SPACING.md,
  },
  hintToastText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.amberText,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: RADII.xl,
    borderWidth: 2,
    borderColor: COLORS.indigo,
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.sm,
    minHeight: SIZES.touchTarget,
  },
  inputBoxWarn: {
    borderColor: COLORS.amber,
  },
  inputBoxLocked: {
    borderColor: COLORS.border,
    opacity: 0.6,
  },
  textInput: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
    paddingVertical: SPACING.md,
  },
  clearBtn: {
    padding: SPACING.xxs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: SPACING.xl,
    minHeight: SIZES.touchTarget,
    borderRadius: RADII.xl,
  },
  nextBtn: {
    backgroundColor: COLORS.indigo,
  },
  stopBtn: {
    backgroundColor: COLORS.stopRed,
    paddingHorizontal: SPACING.xxl,
    ...SHADOWS.stopButtonSm,
  },
  actionBtnPressed: {
    transform: [{ scale: 0.96 }],
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.normal,
  },
  stopOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.huge,
  },
  stopCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.sheet,
    padding: SPACING.huge,
    alignItems: 'center',
    gap: SPACING.md,
  },
  stopIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.stopRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxs,
  },
  stopHeadline: {
    fontSize: FONT_SIZES.display,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.stopRed,
    letterSpacing: LETTER_SPACING.brand,
  },
  stopMessage: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.ink,
    textAlign: 'center',
  },
  stopSub: {
    fontSize: FONT_SIZES.md,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});
