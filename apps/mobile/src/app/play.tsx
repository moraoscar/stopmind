import React, { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { COLORS } from '../constants/game';
import { useGame } from '../context/GameContext';
import { formatSeconds } from '../utils/network';

export default function PlayScreen() {
  const {
    config,
    room,
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {/* TOP HUD: Timer, Rounds Progress, Round Letter */}
        <View style={styles.hud}>
          <View style={styles.hudLeft}>
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
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
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: '#92400E',
  },
  timerTextUrgent: {
    color: '#FFFFFF',
  },
  roundsInfo: {
    flex: 1,
  },
  roundPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  roundSecondary: {
    fontSize: 12,
    color: COLORS.inkMuted,
    fontWeight: '600',
  },
  letterBadge: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 62,
  },
  letterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C7D2FE',
    letterSpacing: 1,
  },
  letterValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 27,
  },
  progressBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catRowActive: {
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.indigoSoft,
  },
  catRowFilled: {
    borderColor: '#A7F3D0',
  },
  catRowDimmed: {
    opacity: 0.55,
  },
  catIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIndexActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.indigo,
  },
  catIndexFilled: {
    backgroundColor: COLORS.emerald,
  },
  catIndexText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.inkMuted,
  },
  catIndexTextActive: {
    color: COLORS.indigo,
  },
  catContent: {
    flex: 1,
  },
  catName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catNameActive: {
    color: COLORS.indigo,
  },
  catValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 1,
  },
  catPlaceholder: {
    color: COLORS.slate,
    fontWeight: '500',
    fontSize: 14,
  },
  catWrongLetter: {
    color: '#B45309',
  },
  editingPill: {
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  editingPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  warnBadge: {
    backgroundColor: COLORS.amberSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warnBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  inputDock: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dockTitleGroup: {
    flex: 1,
    gap: 1,
  },
  dockCategoryLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.ink,
  },
  dockHint: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.indigo,
  },
  dockHintWarn: {
    color: '#B45309',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1,
    borderColor: COLORS.amber,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  helpBtnPressed: {
    transform: [{ scale: 0.96 }],
  },
  helpBtnDisabled: {
    opacity: 0.45,
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  helpCountPill: {
    backgroundColor: '#92400E',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  helpCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  lockBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  hintToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.amberSoft,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  hintToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.indigo,
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 50,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    paddingVertical: 10,
  },
  clearBtn: {
    padding: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 16,
  },
  nextBtn: {
    backgroundColor: COLORS.indigo,
  },
  stopBtn: {
    backgroundColor: COLORS.stopRed,
    paddingHorizontal: 20,
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionBtnPressed: {
    transform: [{ scale: 0.96 }],
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stopOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  stopCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  stopIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.stopRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stopHeadline: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.stopRed,
    letterSpacing: 2,
  },
  stopMessage: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
  },
  stopSub: {
    fontSize: 13,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
});
