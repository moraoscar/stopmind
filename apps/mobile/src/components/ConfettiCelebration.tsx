import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { COLORS } from '../theme/tokens';

const CONFETTI_COLORS = [
  COLORS.accents.yellow,
  COLORS.stopRed,
  COLORS.indigo,
  COLORS.emerald,
  COLORS.accents.cyan,
  COLORS.accents.pink,
  COLORS.accents.orange,
  COLORS.accents.purple,
  COLORS.trophyGold,
];

type ConfettiShape = 'rect' | 'ribbon' | 'circle' | 'square';

interface ConfettiPieceSpec {
  id: number;
  startXRatio: number;
  driftX: number;
  swayAmplitude: number;
  width: number;
  height: number;
  borderRadius: number;
  color: string;
  delayMs: number;
  durationMs: number;
  rotations: number;
  flutterCycles: number;
}

function createSeededRng(seedStr: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildConfettiPieces(
  count: number,
  seed: string,
  isFinal: boolean
): ConfettiPieceSpec[] {
  const rand = createSeededRng(seed);
  const shapes: ConfettiShape[] = ['rect', 'ribbon', 'circle', 'square'];

  return Array.from({ length: count }, (_, idx) => {
    const shape = shapes[idx % shapes.length];
    const color = CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)];
    // Spread across full width evenly with jitter so the entire screen is covered
    const lane = (idx + rand() * 0.85) / count;
    const startXRatio = Math.min(0.98, Math.max(0.02, lane));
    const driftX = (rand() - 0.5) * 140;
    const swayAmplitude = 14 + rand() * 28;

    let width = 10;
    let height = 10;
    let borderRadius = 2;

    if (shape === 'rect') {
      width = 8 + Math.round(rand() * 5);
      height = 12 + Math.round(rand() * 7);
      borderRadius = 2;
    } else if (shape === 'ribbon') {
      width = 5 + Math.round(rand() * 3);
      height = 16 + Math.round(rand() * 10);
      borderRadius = 3;
    } else if (shape === 'circle') {
      const diameter = 7 + Math.round(rand() * 5);
      width = diameter;
      height = diameter;
      borderRadius = diameter / 2;
    } else {
      const side = 8 + Math.round(rand() * 4);
      width = side;
      height = side;
      borderRadius = 2;
    }

    // Two subtle waves on final round for an extra-festive shower
    const waveDelay = isFinal && idx >= Math.floor(count / 2) ? 450 : 0;
    const delayMs = waveDelay + Math.round(rand() * 650);
    const durationMs = 2100 + Math.round(rand() * 1150);
    const spinDirection = rand() > 0.5 ? 1 : -1;
    const rotations = spinDirection * (2 + Math.round(rand() * 4));
    const flutterCycles = 2 + Math.round(rand() * 3);

    return {
      id: idx,
      startXRatio,
      driftX,
      swayAmplitude,
      width,
      height,
      borderRadius,
      color,
      delayMs,
      durationMs,
      rotations,
      flutterCycles,
    };
  });
}

interface ConfettiCelebrationProps {
  /** Whether the confetti celebration should play. */
  active: boolean;
  /** Unique key per round so each winning round triggers a fresh celebration. */
  triggerKey: string;
  /** Slightly denser two-wave shower when winning the final match podium. */
  intensity?: 'round' | 'final';
}

/**
 * Full-screen, non-blocking 60fps confetti celebration overlay using native-driver animations.
 * Respects OS Reduce Motion accessibility preference and auto-unmounts after completion.
 */
export function ConfettiCelebration({
  active,
  triggerKey,
  intensity = 'round',
}: ConfettiCelebrationProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  const isFinal = intensity === 'final';
  const pieceCount = isFinal ? 78 : 54;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {
        // Ignore on unsupported platforms
      });
    return () => {
      mounted = false;
    };
  }, []);

  const shouldRender =
    active && !reduceMotion && triggerKey.length > 0 && completedKey !== triggerKey;

  const pieces = useMemo(
    () => buildConfettiPieces(pieceCount, `${triggerKey}-${intensity}`, isFinal),
    [pieceCount, triggerKey, intensity, isFinal]
  );

  // Allocate reusable Animated.Value array via state so render never reads a ref
  const [progressValues] = useState<Animated.Value[]>(() =>
    Array.from({ length: 80 }, () => new Animated.Value(0))
  );
  const runningAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!shouldRender) return;

    const activeValues = progressValues.slice(0, pieces.length);
    for (const val of activeValues) {
      val.setValue(0);
    }

    const animations = pieces.map((piece, idx) =>
      Animated.sequence([
        Animated.delay(piece.delayMs),
        Animated.timing(activeValues[idx], {
          toValue: 1,
          duration: piece.durationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    const composite = Animated.parallel(animations);
    runningAnimRef.current = composite;
    composite.start(({ finished }) => {
      if (finished) {
        setCompletedKey(triggerKey);
      }
    });

    return () => {
      runningAnimRef.current?.stop();
      runningAnimRef.current = null;
    };
  }, [shouldRender, pieces, progressValues, triggerKey]);

  if (!shouldRender) {
    return null;
  }

  const fallDistance = screenHeight + 120;

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((piece, idx) => {
        const progress = progressValues[idx];
        const startX = piece.startXRatio * screenWidth;

        const translateY = progress.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [-40, screenHeight * 0.06, fallDistance],
        });

        const translateX = progress.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [
            0,
            piece.driftX * 0.28 + piece.swayAmplitude,
            piece.driftX * 0.58 - piece.swayAmplitude * 0.8,
            piece.driftX * 0.85 + piece.swayAmplitude * 0.65,
            piece.driftX,
          ],
        });

        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.rotations * 360}deg`],
        });

        const flutterStops = [0, 0.2, 0.4, 0.6, 0.8, 1];
        const scaleX = progress.interpolate({
          inputRange: flutterStops,
          outputRange:
            piece.flutterCycles % 2 === 0
              ? [1, 0.25, 1, 0.3, 1, 0.4]
              : [0.35, 1, 0.25, 1, 0.3, 1],
        });

        const opacity = progress.interpolate({
          inputRange: [0, 0.06, 0.78, 1],
          outputRange: [0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={piece.id}
            style={[
              styles.piece,
              {
                left: startX,
                width: piece.width,
                height: piece.height,
                borderRadius: piece.borderRadius,
                backgroundColor: piece.color,
                opacity,
                transform: [
                  { translateY },
                  { translateX },
                  { rotate },
                  { scaleX },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    elevation: 999,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: -24,
  },
});
