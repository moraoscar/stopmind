import React from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LETTER_SPACING,
  RADII,
  SPACING,
} from '../theme/tokens';

interface BackdropWord {
  id: string;
  text: string;
  isCategory?: boolean;
  topPct: number;
  leftPct: number;
  rotateDeg: number;
  color: string;
  bg?: string;
  fontSize: number;
}

const A = COLORS.accents;

const BACKDROP_WORDS: BackdropWord[] = [
  // Categories scattered softly across the canvas
  { id: 'hc1', text: 'NOMBRE', isCategory: true, topPct: 4, leftPct: 6, rotateDeg: -10, color: A.darkInk, bg: A.yellow, fontSize: FONT_SIZES.md },
  { id: 'hc2', text: 'ANIMAL', isCategory: true, topPct: 7, leftPct: 66, rotateDeg: 9, color: A.darkInk, bg: A.cyan, fontSize: FONT_SIZES.md },
  { id: 'hc3', text: 'FRUTA', isCategory: true, topPct: 24, leftPct: 72, rotateDeg: -8, color: COLORS.white, bg: A.orange, fontSize: FONT_SIZES.md },
  { id: 'hc4', text: 'COSA', isCategory: true, topPct: 28, leftPct: 4, rotateDeg: 7, color: COLORS.white, bg: COLORS.indigo, fontSize: FONT_SIZES.md },
  { id: 'hc5', text: 'COLOR', isCategory: true, topPct: 65, leftPct: 6, rotateDeg: -9, color: A.darkInk, bg: A.teal, fontSize: FONT_SIZES.md },
  { id: 'hc6', text: 'LUGAR', isCategory: true, topPct: 68, leftPct: 66, rotateDeg: 8, color: COLORS.white, bg: A.pink, fontSize: FONT_SIZES.md },
  { id: 'hc7', text: 'PAÍS', isCategory: true, topPct: 86, leftPct: 12, rotateDeg: -6, color: A.darkInk, bg: A.green, fontSize: FONT_SIZES.md },
  { id: 'hc8', text: 'APELLIDO', isCategory: true, topPct: 88, leftPct: 60, rotateDeg: 6, color: COLORS.white, bg: COLORS.stopRed, fontSize: FONT_SIZES.sm },

  // Abundant Spanish words filling the background canvas
  { id: 'hw1', text: 'María', topPct: 12, leftPct: 26, rotateDeg: -6, color: A.amberInk, fontSize: FONT_SIZES.h2 },
  { id: 'hw2', text: 'León', topPct: 15, leftPct: 60, rotateDeg: 7, color: A.sky, fontSize: FONT_SIZES.h2 },
  { id: 'hw3', text: 'Manzana', topPct: 19, leftPct: 8, rotateDeg: 5, color: A.orangeDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw4', text: 'Madrid', topPct: 22, leftPct: 42, rotateDeg: -4, color: A.pinkDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw5', text: 'Guitarra', topPct: 33, leftPct: 54, rotateDeg: 8, color: COLORS.indigo, fontSize: FONT_SIZES.h2 },
  { id: 'hw6', text: 'Turquesa', topPct: 36, leftPct: 16, rotateDeg: -8, color: A.tealDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw7', text: 'Águila', topPct: 41, leftPct: 70, rotateDeg: -5, color: A.sky, fontSize: FONT_SIZES.h2 },
  { id: 'hw8', text: 'Sofía', topPct: 44, leftPct: 6, rotateDeg: 6, color: A.amberInk, fontSize: FONT_SIZES.h2 },
  { id: 'hw9', text: 'Perú', topPct: 47, leftPct: 44, rotateDeg: -7, color: A.greenDark, fontSize: FONT_SIZES.h1 },
  { id: 'hw10', text: 'Fresa', topPct: 51, leftPct: 74, rotateDeg: 9, color: COLORS.stopRed, fontSize: FONT_SIZES.h3 },
  { id: 'hw11', text: 'Elefante', topPct: 54, leftPct: 14, rotateDeg: -5, color: A.blue, fontSize: FONT_SIZES.h3 },
  { id: 'hw12', text: 'Reloj', topPct: 58, leftPct: 56, rotateDeg: 6, color: COLORS.indigoDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw13', text: 'Brasil', topPct: 61, leftPct: 28, rotateDeg: -6, color: COLORS.emerald, fontSize: FONT_SIZES.h2 },
  { id: 'hw14', text: 'Morado', topPct: 72, leftPct: 36, rotateDeg: 5, color: A.purple, fontSize: FONT_SIZES.h2 },
  { id: 'hw15', text: 'Tigre', topPct: 75, leftPct: 10, rotateDeg: -8, color: A.orangeDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw16', text: 'Mango', topPct: 77, leftPct: 64, rotateDeg: -4, color: A.amberInk, fontSize: FONT_SIZES.h2 },
  { id: 'hw17', text: 'Roma', topPct: 81, leftPct: 38, rotateDeg: 7, color: A.pinkDark, fontSize: FONT_SIZES.h3 },
  { id: 'hw18', text: 'Mateo', topPct: 3, leftPct: 40, rotateDeg: 4, color: COLORS.indigo, fontSize: FONT_SIZES.xxl },
  { id: 'hw19', text: 'Colombia', topPct: 92, leftPct: 32, rotateDeg: -3, color: A.greenDark, fontSize: FONT_SIZES.xxl },
  { id: 'hw20', text: 'Naranja', topPct: 31, leftPct: 32, rotateDeg: 4, color: A.orangeDark, fontSize: FONT_SIZES.xxl },
  { id: 'hw21', text: 'Camila', topPct: 64, leftPct: 76, rotateDeg: -7, color: COLORS.stopRedDark, fontSize: FONT_SIZES.xxl },
  { id: 'hw22', text: 'Delfín', topPct: 49, leftPct: 24, rotateDeg: 5, color: A.sky, fontSize: FONT_SIZES.xxl },
];

export function BlurredWordsBackdrop() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Layer 1: Colorful Spanish categories and words */}
      <View style={StyleSheet.absoluteFill}>
        {BACKDROP_WORDS.map((item) => {
          const top = (item.topPct / 100) * height;
          const left = (item.leftPct / 100) * width;

          return (
            <View
              key={item.id}
              style={[
                styles.itemWrap,
                {
                  top,
                  left,
                  transform: [{ rotate: `${item.rotateDeg}deg` }],
                },
              ]}
            >
              {item.isCategory ? (
                <View
                  style={[
                    styles.categoryPill,
                    { backgroundColor: item.bg ?? COLORS.indigo },
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
            </View>
          );
        })}
      </View>

      {/* Layer 2: Soft frosted blur + warm cream veil for crisp foreground contrast */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 22 : 45}
        tint="light"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.creamVeil} />
    </View>
  );
}

const styles = StyleSheet.create({
  itemWrap: {
    position: 'absolute',
    opacity: 0.42,
  },
  categoryPill: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xxs,
    borderRadius: RADII.pill,
  },
  categoryText: {
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.wide,
  },
  wordText: {
    fontWeight: FONT_WEIGHTS.black,
    letterSpacing: LETTER_SPACING.tight,
  },
  creamVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.creamBlurVeil,
  },
});
