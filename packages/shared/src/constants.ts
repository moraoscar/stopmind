import { GameConfig } from './types';

export const DEFAULT_CATEGORIES: string[] = [
  'Nombre',
  'Apellido',
  'Animal',
  'Cosa',
  'Color',
  'Lugar',
  'Fruta',
];

export const BONUS_CATEGORIES: string[] = [
  'País o Ciudad',
  'Comida',
  'Profesión',
  'Película o Serie',
  'Marca',
  'Deporte',
  'Cantante o Banda',
];

export const TIME_PRESETS: { label: string; seconds: number }[] = [
  { label: '30 seg', seconds: 30 },
  { label: '45 seg', seconds: 45 },
  { label: '1 min', seconds: 60 },
  { label: '1:30 min', seconds: 90 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
];

export const STOP_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
];

export const FULL_SPANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

export const DEFAULT_CONFIG: GameConfig = {
  categories: [...DEFAULT_CATEGORIES],
  allowedLetters: [...STOP_ALPHABET],
  timeLimitSeconds: 60,
  totalRounds: 3,
  validateLetter: true,
  aiValidation: true,
  hintsEnabled: true,
  hintPenaltyMode: 'points',
  hintPenaltyPoints: 20,
  hintLockSeconds: 15,
};

export const DEFAULT_SERVER_PORT = 3001;
