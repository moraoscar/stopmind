import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import STOP_HAND_LOTTIE from '../../assets/lottie/stop-hand.json';

interface FloatingItem {
  id: string;
  text: string;
  isCategory: boolean;
  topPct: number;
  leftPct: number;
  rotateDeg: number;
  color: string;
  bg?: string;
  fontSize: number;
  delayMs: number;
}

// Stage 1: Categories appear first; Stage 2: Spanish words cascade to fill the screen
const FLOATING_ITEMS: FloatingItem[] = [
  // Categories (0 - 650ms)
  { id: 'c1', text: 'NOMBRE', isCategory: true, topPct: 10, leftPct: 8, rotateDeg: -9, color: '#0F172A', bg: '#FACC15', fontSize: 15, delayMs: 80 },
  { id: 'c2', text: 'ANIMAL', isCategory: true, topPct: 14, leftPct: 58, rotateDeg: 8, color: '#0F172A', bg: '#22D3EE', fontSize: 15, delayMs: 170 },
  { id: 'c3', text: 'FRUTA', isCategory: true, topPct: 27, leftPct: 64, rotateDeg: -7, color: '#FFFFFF', bg: '#F97316', fontSize: 15, delayMs: 260 },
  { id: 'c4', text: 'COSA', isCategory: true, topPct: 29, leftPct: 7, rotateDeg: 6, color: '#0F172A', bg: '#FFFFFF', fontSize: 15, delayMs: 350 },
  { id: 'c5', text: 'COLOR', isCategory: true, topPct: 71, leftPct: 9, rotateDeg: -8, color: '#0F172A', bg: '#2DD4BF', fontSize: 15, delayMs: 440 },
  { id: 'c6', text: 'LUGAR', isCategory: true, topPct: 74, leftPct: 60, rotateDeg: 9, color: '#FFFFFF', bg: '#EC4899', fontSize: 15, delayMs: 530 },
  { id: 'c7', text: 'PAÍS', isCategory: true, topPct: 84, leftPct: 36, rotateDeg: -4, color: '#0F172A', bg: '#34D399', fontSize: 15, delayMs: 620 },

  // Words filling the screen rapidly (720 - 1850ms)
  { id: 'w1', text: 'María', isCategory: false, topPct: 18, leftPct: 24, rotateDeg: -5, color: '#FEF08A', fontSize: 24, delayMs: 740 },
  { id: 'w2', text: 'León', isCategory: false, topPct: 21, leftPct: 62, rotateDeg: 7, color: '#A5F3FC', fontSize: 25, delayMs: 830 },
  { id: 'w3', text: 'Manzana', isCategory: false, topPct: 36, leftPct: 46, rotateDeg: -6, color: '#FED7AA', fontSize: 26, delayMs: 920 },
  { id: 'w4', text: 'Guitarra', isCategory: false, topPct: 38, leftPct: 8, rotateDeg: 5, color: '#E2E8F0', fontSize: 22, delayMs: 1010 },
  { id: 'w5', text: 'Madrid', isCategory: false, topPct: 47, leftPct: 58, rotateDeg: 8, color: '#FBCFE8', fontSize: 25, delayMs: 1090 },
  { id: 'w6', text: 'Turquesa', isCategory: false, topPct: 48, leftPct: 12, rotateDeg: -8, color: '#99F6E4', fontSize: 23, delayMs: 1170 },
  { id: 'w7', text: 'Águila', isCategory: false, topPct: 56, leftPct: 38, rotateDeg: 4, color: '#67E8F9', fontSize: 26, delayMs: 1250 },
  { id: 'w8', text: 'Perú', isCategory: false, topPct: 60, leftPct: 72, rotateDeg: -7, color: '#6EE7B7', fontSize: 24, delayMs: 1320 },
  { id: 'w9', text: 'Sofía', isCategory: false, topPct: 61, leftPct: 8, rotateDeg: 6, color: '#FDE047', fontSize: 24, delayMs: 1390 },
  { id: 'w10', text: 'Fresa', isCategory: false, topPct: 42, leftPct: 34, rotateDeg: -4, color: '#FDBA74', fontSize: 22, delayMs: 1460 },
  { id: 'w11', text: 'Reloj', isCategory: false, topPct: 66, leftPct: 42, rotateDeg: 7, color: '#F8FAFC', fontSize: 22, delayMs: 1530 },
  { id: 'w12', text: 'Brasil', isCategory: false, topPct: 79, leftPct: 16, rotateDeg: -6, color: '#A7F3D0', fontSize: 23, delayMs: 1600 },
  { id: 'w13', text: 'Morado', isCategory: false, topPct: 81, leftPct: 62, rotateDeg: 5, color: '#C4B5FD', fontSize: 22, delayMs: 1670 },
  { id: 'w14', text: 'Mateo', isCategory: false, topPct: 7, leftPct: 40, rotateDeg: 3, color: '#FEF08A', fontSize: 20, delayMs: 1740 },
  { id: 'w15', text: 'Tigre', isCategory: false, topPct: 52, leftPct: 24, rotateDeg: -9, color: '#BAE6FD', fontSize: 22, delayMs: 1800 },
  { id: 'w16', text: 'Mango', isCategory: false, topPct: 89, leftPct: 14, rotateDeg: 4, color: '#FDBA74', fontSize: 21, delayMs: 1860 },
  { id: 'w17', text: 'Roma', isCategory: false, topPct: 89, leftPct: 66, rotateDeg: -5, color: '#F9A8D4', fontSize: 22, delayMs: 1920 },
];

interface AnimatedSplashProps {
  onFinish: () => void;
}

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const { width, height } = useWindowDimensions();

  const [itemAnims] = useState(() =>
    FLOATING_ITEMS.map(() => ({
      scale: new Animated.Value(0.25),
      opacity: new Animated.Value(0),
    }))
  );

  const [blurOpacity] = useState(() => new Animated.Value(0));
  const [stopPillScale] = useState(() => new Animated.Value(0.3));
  const [stopPillOpacity] = useState(() => new Animated.Value(0));
  const [containerOpacity] = useState(() => new Animated.Value(1));
  const [containerScale] = useState(() => new Animated.Value(1));

  const lottieRef = useRef<LottieView>(null);
  const finishedRef = useRef(false);
  const [showStopStage, setShowStopStage] = useState(false);

  const dismiss = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(containerScale, {
        toValue: 1.06,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [containerOpacity, containerScale, onFinish]);

  useEffect(() => {
    // Hide native static splash right as our navy-matched animated splash mounts
    void SplashScreen.hideAsync().catch(() => undefined);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phases 1 & 2: Categories then cascading words
    FLOATING_ITEMS.forEach((item, index) => {
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.spring(itemAnims[index].scale, {
            toValue: 1,
            friction: 6,
            tension: 120,
            useNativeDriver: true,
          }),
          Animated.timing(itemAnims[index].opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      }, item.delayMs);
      timers.push(t);
    });

    // Phase 3: Blur all background words + Lottie STOP hand burst in center
    const stopTimer = setTimeout(() => {
      setShowStopStage(true);
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
          () => undefined
        );
      }

      Animated.parallel([
        Animated.timing(blurOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(90),
          Animated.parallel([
            Animated.spring(stopPillScale, {
              toValue: 1,
              friction: 5,
              tension: 130,
              useNativeDriver: true,
            }),
            Animated.timing(stopPillOpacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();

      const playTimer = setTimeout(() => {
        lottieRef.current?.play();
      }, 20);
      timers.push(playTimer);
    }, 2120);
    timers.push(stopTimer);

    // Phase 4: Reveal Home screen
    const endTimer = setTimeout(() => {
      dismiss();
    }, 3550);
    timers.push(endTimer);

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [blurOpacity, dismiss, itemAnims, stopPillOpacity, stopPillScale]);

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        {/* Layer 1: Categories & cascading Spanish words filling the screen */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {FLOATING_ITEMS.map((item, idx) => {
            const anim = itemAnims[idx];
            const top = (item.topPct / 100) * height;
            const left = (item.leftPct / 100) * width;

            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.floatingWrap,
                  {
                    top,
                    left,
                    opacity: anim.opacity,
                    transform: [
                      { rotate: `${item.rotateDeg}deg` },
                      { scale: anim.scale },
                    ],
                  },
                ]}
              >
                {item.isCategory ? (
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: item.bg ?? '#4F46E5' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        { color: item.color, fontSize: item.fontSize },
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.wordText,
                      { color: item.color, fontSize: item.fontSize },
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Layer 2: Frosted Blur over words when STOP hits */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}
          pointerEvents="none"
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 42 : 70}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.blurNavyTint} />
        </Animated.View>

        {/* Layer 3: Center Lottie STOP Hand + STOP Badge */}
        {showStopStage && (
          <View style={styles.centerStage} pointerEvents="none">
            <View style={styles.lottieWrap}>
              <LottieView
                ref={lottieRef}
                source={STOP_HAND_LOTTIE}
                autoPlay
                loop={false}
                style={styles.lottie}
              />

              <Animated.View
                style={[
                  styles.stopBadgeWrap,
                  {
                    opacity: stopPillOpacity,
                    transform: [{ scale: stopPillScale }],
                  },
                ]}
              >
                <View style={styles.stopBadge}>
                  <Text style={styles.stopWord}>STOP</Text>
                </View>
              </Animated.View>
            </View>

            <Animated.Text
              style={[
                styles.brandTitle,
                {
                  opacity: stopPillOpacity,
                  transform: [{ scale: stopPillScale }],
                },
              ]}
            >
              STOPMind!
            </Animated.Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#001C55',
    zIndex: 999,
    elevation: 999,
  },
  floatingWrap: {
    position: 'absolute',
  },
  categoryPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  categoryText: {
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  wordText: {
    fontWeight: '900',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 10, 35, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  blurNavyTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 22, 68, 0.42)',
  },
  centerStage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 280,
    height: 280,
  },
  stopBadgeWrap: {
    position: 'absolute',
    top: '48%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#991B1B',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  stopWord: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 3,
  },
  brandTitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
