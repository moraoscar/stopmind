import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * StopMind! Design System Tokens
 * ------------------------------
 * Archivo centralizado de colores, tipografía, espaciado, radios y sombras.
 * Modifica los valores aquí para actualizar el estilo de toda la aplicación.
 */

export const COLORS = {
  // Superficies y fondos
  bg: '#F7F6F2',
  surface: '#FFFFFF',
  surfaceTranslucent: 'rgba(255, 255, 255, 0.94)',
  surfaceAlt: '#EFECE4',
  border: '#E4E0D5',

  // Fondos oscuros / Splash / Overlays
  navy: '#001C55',
  navyBlurTint: 'rgba(0, 22, 68, 0.42)',
  creamBlurVeil: 'rgba(250, 248, 244, 0.56)',
  cameraBg: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.55)',
  overlayStrong: 'rgba(15, 23, 42, 0.72)',
  overlaySoft: 'rgba(15, 23, 42, 0.28)',
  cameraPillBg: 'rgba(15, 23, 42, 0.78)',

  // Texto e iconos
  ink: '#161822',
  inkMuted: '#646A7D',
  slate: '#94A3B8',
  white: '#FFFFFF',
  black: '#000000',

  // Marca principal (Rojo STOP)
  stopRed: '#EF4444',
  stopRedDark: '#C81E1E',
  stopRedShadow: '#991B1B',
  stopRedSoft: '#FEE2E2',
  stopRedRingOuter: 'rgba(239, 68, 68, 0.10)',
  stopRedRingMiddle: 'rgba(239, 68, 68, 0.18)',

  // Acento primario (Índigo)
  indigo: '#4F46E5',
  indigoDark: '#3730A3',
  indigoSoft: '#EEF2FF',
  indigoBorder: '#C7D2FE',

  // Éxito / Conectado (Esmeralda)
  emerald: '#10B981',
  emeraldDark: '#047857',
  emeraldSoft: '#D1FAE5',
  emeraldBorder: '#A7F3D0',

  // Alerta / Ayuda / Empate (Ámbar)
  amber: '#F59E0B',
  amberDark: '#B45309',
  amberText: '#92400E',
  amberSoft: '#FEF3C7',
  amberBorder: '#FDE68A',

  // Medallas y destacados
  trophyGold: '#FDE047',
  medalGold: '#F59E0B',
  medalSilver: '#94A3B8',
  medalBronze: '#B45309',
  mintHighlight: '#A7F3D0',

  // Paleta vibrante para categorías, splash y fondo difuminado
  accents: {
    yellow: '#FACC15',
    yellowSoft: '#FEF08A',
    cyan: '#22D3EE',
    cyanSoft: '#A5F3FC',
    sky: '#0284C7',
    teal: '#2DD4BF',
    tealDark: '#0D9488',
    orange: '#F97316',
    orangeDark: '#EA580C',
    orangeSoft: '#FED7AA',
    pink: '#EC4899',
    pinkDark: '#DB2777',
    pinkSoft: '#FBCFE8',
    purple: '#7C3AED',
    purpleSoft: '#C4B5FD',
    green: '#34D399',
    greenDark: '#059669',
    blue: '#2563EB',
    amberInk: '#D97706',
    darkInk: '#0F172A',
    lightSlate: '#E2E8F0',
  },
} as const;

export const FONTS = {
  /** Cambia aquí para usar una fuente personalizada (ej. cargada con expo-font) */
  regular: undefined as string | undefined,
  medium: undefined as string | undefined,
  bold: undefined as string | undefined,
  mono: Platform.select({
    ios: 'Courier',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

export const FONT_SIZES = {
  micro: 9,
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  body: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  h3: 22,
  h2: 24,
  h1: 26,
  title: 28,
  display: 30,
  hero: 32,
  giant: 34,
} as const;

export const FONT_WEIGHTS = {
  regular: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
  black: '900' as TextStyle['fontWeight'],
} as const;

export const LETTER_SPACING = {
  tight: 0.3,
  normal: 0.6,
  wide: 1.0,
  wider: 1.5,
  brand: 2.2,
  play: 2.5,
  logo: 3.0,
  code: 6.0,
} as const;

export const SPACING = {
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 10,
  base: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  huge: 28,
} as const;

export const RADII = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  card: 22,
  modal: 24,
  sheet: 28,
  pill: 999,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: COLORS.black,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: COLORS.black,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } satisfies ViewStyle,
  lg: {
    shadowColor: COLORS.black,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } satisfies ViewStyle,
  stopButton: {
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  } satisfies ViewStyle,
  stopButtonSm: {
    shadowColor: COLORS.stopRedDark,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  } satisfies ViewStyle,
  splashStopBadge: {
    shadowColor: COLORS.stopRedShadow,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  } satisfies ViewStyle,
} as const;

export const SIZES = {
  iconBtn: 40,
  closeBtn: 36,
  touchTarget: 50,
  statusDot: 8,
  homePlayButton: {
    regular: { outer: 244, middle: 214, inner: 184 },
    compact: { outer: 216, middle: 188, inner: 160 },
  },
} as const;

export const TYPOGRAPHY = {
  screenTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  } satisfies TextStyle,
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.extrabold,
    color: COLORS.ink,
  } satisfies TextStyle,
  cardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkMuted,
  } satisfies TextStyle,
  buttonPrimary: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.black,
    color: COLORS.white,
    letterSpacing: LETTER_SPACING.wide,
  } satisfies TextStyle,
} as const;

export const THEME = {
  colors: COLORS,
  fonts: FONTS,
  fontSizes: FONT_SIZES,
  fontWeights: FONT_WEIGHTS,
  letterSpacing: LETTER_SPACING,
  spacing: SPACING,
  radii: RADII,
  shadows: SHADOWS,
  sizes: SIZES,
  typography: TYPOGRAPHY,
} as const;

export type AppTheme = typeof THEME;
