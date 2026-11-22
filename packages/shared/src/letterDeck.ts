import { FULL_SPANISH_ALPHABET, STOP_ALPHABET } from './constants';

const VALID_LETTER_SET = new Set(FULL_SPANISH_ALPHABET);

export function sanitizeAllowedLetters(raw?: unknown): string[] {
  if (!Array.isArray(raw)) return [...STOP_ALPHABET];
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const upper = item.trim().toUpperCase();
    if (VALID_LETTER_SET.has(upper) && !seen.has(upper)) {
      seen.add(upper);
      cleaned.push(upper);
    }
  }
  return cleaned.length > 0 ? cleaned : [...STOP_ALPHABET];
}

function shuffleFisherYates<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class LetterDeck {
  private deck: string[] = [];
  private lastLetter: string | null = null;

  draw(allowedLetters: string[]): string {
    const pool = sanitizeAllowedLetters(allowedLetters);
    const poolSet = new Set(pool);

    this.deck = this.deck.filter((letter) => poolSet.has(letter));

    if (this.deck.length === 0) {
      const fresh = shuffleFisherYates(pool);
      if (fresh.length > 1 && this.lastLetter && fresh[0] === this.lastLetter) {
        const swapIdx = 1 + Math.floor(Math.random() * (fresh.length - 1));
        [fresh[0], fresh[swapIdx]] = [fresh[swapIdx], fresh[0]];
      }
      this.deck = fresh;
    }

    const next = this.deck.shift() ?? pool[0];
    this.lastLetter = next;
    return next;
  }
}
