import { DEFAULT_CATEGORIES } from './constants';
import { sanitizeAllowedLetters } from './letterDeck';
import { GameConfig } from './types';

export function sanitizeConfig(raw: Partial<GameConfig>): GameConfig {
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((c) => c.trim()).filter(Boolean)
    : DEFAULT_CATEGORIES;
  return {
    categories:
      categories.length > 0 ? [...new Set(categories)] : [...DEFAULT_CATEGORIES],
    allowedLetters: sanitizeAllowedLetters(raw.allowedLetters),
    timeLimitSeconds: Math.max(
      15,
      Math.min(300, Number(raw.timeLimitSeconds) || 60)
    ),
    totalRounds: Math.max(1, Math.min(15, Number(raw.totalRounds) || 3)),
    validateLetter:
      typeof raw.validateLetter === 'boolean' ? raw.validateLetter : true,
    aiValidation:
      typeof raw.aiValidation === 'boolean' ? raw.aiValidation : true,
    hintsEnabled:
      typeof raw.hintsEnabled === 'boolean' ? raw.hintsEnabled : true,
    hintPenaltyMode:
      raw.hintPenaltyMode === 'lock' || raw.hintPenaltyMode === 'both'
        ? raw.hintPenaltyMode
        : 'points',
    hintPenaltyPoints: Math.max(
      0,
      Math.min(100, Number(raw.hintPenaltyPoints ?? 20))
    ),
    hintLockSeconds: Math.max(
      1,
      Math.min(60, Number(raw.hintLockSeconds ?? 15))
    ),
  };
}
