// Fast, deterministic, offline Layer 1 word sanity validator (accent-insensitive)

const KEYBOARD_PATTERNS = [
  'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
  'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
  'zxcv', 'xcvb', 'cvbn', 'vbnm',
  'abcd', 'bcde', 'cdef', 'defg', 'wxyz', 'xyz', 'qaz', 'wsx', 'edc',
];

const ALLOWED_TWO_LETTER = new Set([
  'te', 'fe', 'aj', 'lu', 'bo', 'po', 'al', 'li', 'yo', 'tu', 'si', 'no', 'oz', 'io', 'pi',
]);

export function canonicalizeInput(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAccentsLower(raw: string): string {
  return canonicalizeInput(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface LocalWordVerdict {
  valid: boolean;
  reason?: string;
}

export function validateWordLocally(rawWord: string): LocalWordVerdict {
  const cleaned = stripAccentsLower(rawWord);
  if (!cleaned) {
    return { valid: false, reason: 'Sin respuesta' };
  }

  const alphaOnly = cleaned.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const compact = alphaOnly.replace(/\s+/g, '');

  if (compact.length === 0) {
    return { valid: false, reason: 'No contiene letras' };
  }
  if (compact.length < 2) {
    return { valid: false, reason: 'Una sola letra no es válida' };
  }
  if (compact.length === 2 && !ALLOWED_TWO_LETTER.has(compact)) {
    return { valid: false, reason: 'Palabra demasiado corta' };
  }
  if (/(.)\1{2,}/.test(compact)) {
    return { valid: false, reason: 'Texto repetitivo inválido' };
  }
  if (compact.length >= 6 && /^(.{1,2})\1{2,}$/.test(compact)) {
    return { valid: false, reason: 'No es una palabra real' };
  }
  for (const pattern of KEYBOARD_PATTERNS) {
    if (compact.includes(pattern)) {
      return { valid: false, reason: 'No es una palabra real' };
    }
  }
  if (!/[aeiou]/.test(compact)) {
    return { valid: false, reason: 'No es una palabra real' };
  }
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(compact)) {
    return { valid: false, reason: 'No es una palabra real' };
  }
  if (/[aeiou]{4,}/.test(compact)) {
    return { valid: false, reason: 'No es una palabra real' };
  }
  const tokens = alphaOnly.split(' ').filter((t) => t.length >= 3);
  for (const token of tokens) {
    if (!/[aeiou]/.test(token)) {
      return { valid: false, reason: 'No es una palabra real' };
    }
  }

  return { valid: true };
}
