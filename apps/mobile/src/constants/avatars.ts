import type { ImageSourcePropType } from 'react-native';
import { COLORS } from '../theme/tokens';
import { DEFAULT_AVATAR_BG_ID, DEFAULT_AVATAR_ID } from '../utils/playerStorage';

export interface AvatarBgOption {
  id: string;
  label: string;
  bgColor: string;
  ringColor: string;
}

export const AVATAR_BG_COLORS: readonly AvatarBgOption[] = [
  { id: 'indigo', label: 'Índigo', bgColor: '#6366F1', ringColor: '#4338CA' },
  { id: 'sky', label: 'Cielo', bgColor: '#38BDF8', ringColor: '#0284C7' },
  { id: 'emerald', label: 'Esmeralda', bgColor: '#34D399', ringColor: '#059669' },
  { id: 'gold', label: 'Sol', bgColor: '#FACC15', ringColor: '#CA8A04' },
  { id: 'coral', label: 'Coral', bgColor: '#FB7185', ringColor: '#E11D48' },
  { id: 'purple', label: 'Morado', bgColor: '#A855F7', ringColor: '#7E22CE' },
  { id: 'orange', label: 'Naranja', bgColor: '#FB923C', ringColor: '#EA580C' },
  { id: 'teal', label: 'Turquesa', bgColor: '#2DD4BF', ringColor: '#0D9488' },
  { id: 'pink', label: 'Rosa', bgColor: '#F472B6', ringColor: '#DB2777' },
  { id: 'blue', label: 'Azul', bgColor: '#60A5FA', ringColor: '#2563EB' },
  { id: 'red', label: 'Rojo STOP', bgColor: '#EF4444', ringColor: '#B91C1C' },
  { id: 'navy', label: 'Marino', bgColor: COLORS.navy, ringColor: '#1E3A8A' },
] as const;

const AVATAR_BG_MAP = new Map<string, AvatarBgOption>(
  AVATAR_BG_COLORS.map((item) => [item.id, item])
);

const DEFAULT_AVATAR_BG =
  AVATAR_BG_MAP.get(DEFAULT_AVATAR_BG_ID) ?? AVATAR_BG_COLORS[0];

export interface AvatarOption {
  id: string;
  label: string;
  defaultBgId: string;
  source: ImageSourcePropType;
}

export const AVATARS: readonly AvatarOption[] = [
  {
    id: 'nino',
    label: 'Niño',
    defaultBgId: 'sky',
    source: require('../../assets/avatars/nino.png'),
  },
  {
    id: 'nina',
    label: 'Niña',
    defaultBgId: 'gold',
    source: require('../../assets/avatars/nina.png'),
  },
  {
    id: 'joven_m',
    label: 'Chico',
    defaultBgId: 'indigo',
    source: require('../../assets/avatars/joven_m.png'),
  },
  {
    id: 'joven_f',
    label: 'Chica',
    defaultBgId: 'coral',
    source: require('../../assets/avatars/joven_f.png'),
  },
  {
    id: 'adulto_limpio',
    label: 'Adulto',
    defaultBgId: 'emerald',
    source: require('../../assets/avatars/adulto_limpio.png'),
  },
  {
    id: 'adulto_barba',
    label: 'Con barba',
    defaultBgId: 'orange',
    source: require('../../assets/avatars/adulto_barba.png'),
  },
  {
    id: 'calvo_limpio',
    label: 'Calvo',
    defaultBgId: 'teal',
    source: require('../../assets/avatars/calvo_limpio.png'),
  },
  {
    id: 'calvo_barba',
    label: 'Calvo barba',
    defaultBgId: 'purple',
    source: require('../../assets/avatars/calvo_barba.png'),
  },
  {
    id: 'mujer_corto',
    label: 'Cabello corto',
    defaultBgId: 'pink',
    source: require('../../assets/avatars/mujer_corto.png'),
  },
  {
    id: 'mujer_largo',
    label: 'Cabello largo',
    defaultBgId: 'teal',
    source: require('../../assets/avatars/mujer_largo.png'),
  },
  {
    id: 'mujer_rizos',
    label: 'Rizos',
    defaultBgId: 'gold',
    source: require('../../assets/avatars/mujer_rizos.png'),
  },
  {
    id: 'genio',
    label: 'Mente rápida',
    defaultBgId: 'red',
    source: require('../../assets/avatars/genio.png'),
  },
  {
    id: 'abuelo_claro',
    label: 'Abuelo',
    defaultBgId: 'blue',
    source: require('../../assets/avatars/abuelo_claro.png'),
  },
  {
    id: 'abuelo_moreno',
    label: 'Abuelo',
    defaultBgId: 'emerald',
    source: require('../../assets/avatars/abuelo_moreno.png'),
  },
  {
    id: 'abuela_clara',
    label: 'Abuela',
    defaultBgId: 'pink',
    source: require('../../assets/avatars/abuela_clara.png'),
  },
  {
    id: 'abuela_morena',
    label: 'Abuela',
    defaultBgId: 'purple',
    source: require('../../assets/avatars/abuela_morena.png'),
  },
] as const;

const AVATAR_MAP = new Map<string, AvatarOption>(
  AVATARS.map((item) => [item.id, item])
);

// Legacy ID aliases so anyone who selected an earlier v1 avatar ID keeps working seamlessly
const LEGACY_AVATAR_ALIAS: Record<string, string> = {
  adulto_m: 'adulto_barba',
  calvo: 'calvo_limpio',
  abuelo: 'abuelo_claro',
  abuela: 'abuela_clara',
};

const DEFAULT_AVATAR =
  AVATAR_MAP.get(DEFAULT_AVATAR_ID) ?? AVATARS[0];

/**
 * Resolves a bundled transparent AvatarOption from an avatarId.
 * Falls back deterministically by playerName for older clients without avatarId.
 */
export function getAvatarOption(
  avatarId?: string | null,
  fallbackSeed?: string
): AvatarOption {
  if (avatarId) {
    const clean = avatarId.trim().toLowerCase();
    const mappedId = LEGACY_AVATAR_ALIAS[clean] ?? clean;
    const exact = AVATAR_MAP.get(mappedId);
    if (exact) return exact;
  }
  if (fallbackSeed && fallbackSeed.trim()) {
    let hash = 0;
    const text = fallbackSeed.trim().toLowerCase();
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return AVATARS[hash % AVATARS.length];
  }
  return DEFAULT_AVATAR;
}

/**
 * Resolves a background color option from a palette ID, falling back to the
 * avatar's curated default color when not explicitly set.
 */
export function getAvatarBgOption(
  bgId?: string | null,
  fallbackAvatar?: AvatarOption
): AvatarBgOption {
  if (bgId) {
    const exact = AVATAR_BG_MAP.get(bgId.trim().toLowerCase());
    if (exact) return exact;
  }
  if (fallbackAvatar) {
    const fromAvatar = AVATAR_BG_MAP.get(fallbackAvatar.defaultBgId);
    if (fromAvatar) return fromAvatar;
  }
  return DEFAULT_AVATAR_BG;
}
