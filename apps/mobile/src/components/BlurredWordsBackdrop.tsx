import React from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';

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

const BACKDROP_WORDS: BackdropWord[] = [
  // Categories scattered softly across the canvas
  { id: 'hc1', text: 'NOMBRE', isCategory: true, topPct: 4, leftPct: 6, rotateDeg: -10, color: '#0F172A', bg: '#FACC15', fontSize: 13 },
  { id: 'hc2', text: 'ANIMAL', isCategory: true, topPct: 7, leftPct: 66, rotateDeg: 9, color: '#0F172A', bg: '#22D3EE', fontSize: 13 },
  { id: 'hc3', text: 'FRUTA', isCategory: true, topPct: 24, leftPct: 72, rotateDeg: -8, color: '#FFFFFF', bg: '#F97316', fontSize: 13 },
  { id: 'hc4', text: 'COSA', isCategory: true, topPct: 28, leftPct: 4, rotateDeg: 7, color: '#FFFFFF', bg: '#6366F1', fontSize: 13 },
  { id: 'hc5', text: 'COLOR', isCategory: true, topPct: 65, leftPct: 6, rotateDeg: -9, color: '#0F172A', bg: '#2DD4BF', fontSize: 13 },
  { id: 'hc6', text: 'LUGAR', isCategory: true, topPct: 68, leftPct: 66, rotateDeg: 8, color: '#FFFFFF', bg: '#EC4899', fontSize: 13 },
  { id: 'hc7', text: 'PAÍS', isCategory: true, topPct: 86, leftPct: 12, rotateDeg: -6, color: '#0F172A', bg: '#34D399', fontSize: 13 },
  { id: 'hc8', text: 'APELLIDO', isCategory: true, topPct: 88, leftPct: 60, rotateDeg: 6, color: '#FFFFFF', bg: '#EF4444', fontSize: 12 },

  // Abundant Spanish words filling the background canvas
  { id: 'hw1', text: 'María', topPct: 12, leftPct: 26, rotateDeg: -6, color: '#D97706', fontSize: 24 },
  { id: 'hw2', text: 'León', topPct: 15, leftPct: 60, rotateDeg: 7, color: '#0284C7', fontSize: 25 },
  { id: 'hw3', text: 'Manzana', topPct: 19, leftPct: 8, rotateDeg: 5, color: '#EA580C', fontSize: 22 },
  { id: 'hw4', text: 'Madrid', topPct: 22, leftPct: 42, rotateDeg: -4, color: '#DB2777', fontSize: 23 },
  { id: 'hw5', text: 'Guitarra', topPct: 33, leftPct: 54, rotateDeg: 8, color: '#4F46E5', fontSize: 24 },
  { id: 'hw6', text: 'Turquesa', topPct: 36, leftPct: 16, rotateDeg: -8, color: '#0D9488', fontSize: 23 },
  { id: 'hw7', text: 'Águila', topPct: 41, leftPct: 70, rotateDeg: -5, color: '#0891B2', fontSize: 24 },
  { id: 'hw8', text: 'Sofía', topPct: 44, leftPct: 6, rotateDeg: 6, color: '#CA8A04', fontSize: 25 },
  { id: 'hw9', text: 'Perú', topPct: 47, leftPct: 44, rotateDeg: -7, color: '#059669', fontSize: 26 },
  { id: 'hw10', text: 'Fresa', topPct: 51, leftPct: 74, rotateDeg: 9, color: '#EF4444', fontSize: 23 },
  { id: 'hw11', text: 'Elefante', topPct: 54, leftPct: 14, rotateDeg: -5, color: '#2563EB', fontSize: 22 },
  { id: 'hw12', text: 'Reloj', topPct: 58, leftPct: 56, rotateDeg: 6, color: '#4338CA', fontSize: 23 },
  { id: 'hw13', text: 'Brasil', topPct: 61, leftPct: 28, rotateDeg: -6, color: '#10B981', fontSize: 24 },
  { id: 'hw14', text: 'Morado', topPct: 72, leftPct: 36, rotateDeg: 5, color: '#7C3AED', fontSize: 24 },
  { id: 'hw15', text: 'Tigre', topPct: 75, leftPct: 10, rotateDeg: -8, color: '#EA580C', fontSize: 23 },
  { id: 'hw16', text: 'Mango', topPct: 77, leftPct: 64, rotateDeg: -4, color: '#D97706', fontSize: 24 },
  { id: 'hw17', text: 'Roma', topPct: 81, leftPct: 38, rotateDeg: 7, color: '#DB2777', fontSize: 23 },
  { id: 'hw18', text: 'Mateo', topPct: 3, leftPct: 40, rotateDeg: 4, color: '#4F46E5', fontSize: 20 },
  { id: 'hw19', text: 'Colombia', topPct: 92, leftPct: 32, rotateDeg: -3, color: '#059669', fontSize: 21 },
  { id: 'hw20', text: 'Naranja', topPct: 31, leftPct: 32, rotateDeg: 4, color: '#EA580C', fontSize: 21 },
  { id: 'hw21', text: 'Camila', topPct: 64, leftPct: 76, rotateDeg: -7, color: '#DC2626', fontSize: 21 },
  { id: 'hw22', text: 'Delfín', topPct: 49, leftPct: 24, rotateDeg: 5, color: '#0284C7', fontSize: 21 },
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
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
  wordText: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  creamVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(250, 248, 244, 0.56)',
  },
});
