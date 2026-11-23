import {
  ApiHintResponse,
  ApiValidateRoundResponse,
  makeValidationKey,
} from '@stopmind/shared';
import {
  BoundedMap,
  isAllowedApiBaseUrl,
  MAX_HINT_LENGTH,
  MAX_LOCAL_CACHE_ENTRIES,
  MAX_REASON_LENGTH,
  sanitizeDisplayText,
} from './security';

export interface WordCheckItem {
  key: string;
  category: string;
  word: string;
  letter: string;
}

export interface WordVerdict {
  valid: boolean;
  reason?: string;
}

// Module 9.3 — Bounded local session cache (max 500 entries) so memory never grows unbounded
const localVerdictCache = new BoundedMap<string, WordVerdict>(
  MAX_LOCAL_CACHE_ENTRIES
);

// Ephemeral anonymous installation ID for fair rate-limiting (zero PII)
const anonymousClientId = `sm_${Math.random().toString(36).slice(2, 12)}`;

function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/\/+$/, '');
  return isAllowedApiBaseUrl(cleaned) ? cleaned : '';
}

/**
 * Calls the StopMind! secure AWS backend (apps/api) to validate round words with Gemini.
 * - Zero API keys stored in the mobile app (OWASP MASVS-STORAGE).
 * - Zero PII transmitted (only category + word pairs).
 * - Automatic offline fallback when playing on local Wi-Fi without internet.
 */
export async function validateRoundViaBackend(params: {
  items: WordCheckItem[];
  timeoutMs?: number;
}): Promise<{ verdicts: Map<string, WordVerdict>; usedAi: boolean }> {
  const { items, timeoutMs = 7000 } = params;
  const verdicts = new Map<string, WordVerdict>();

  const apiBase = getApiBaseUrl();
  if (!apiBase || items.length === 0) {
    return { verdicts, usedAi: false };
  }

  const uncached: WordCheckItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cached = localVerdictCache.get(item.key);
    if (cached) {
      verdicts.set(item.key, cached);
      continue;
    }
    if (!seen.has(item.key)) {
      seen.add(item.key);
      uncached.push(item);
    }
  }

  if (uncached.length === 0) {
    return { verdicts, usedAi: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiBase}/v1/validate-round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': anonymousClientId,
      },
      body: JSON.stringify({
        items: uncached.slice(0, 20).map((item, id) => ({
          id,
          category: item.category,
          word: item.word,
          letter: item.letter ? item.letter.toUpperCase() : undefined,
        })),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) {
      return { verdicts, usedAi: verdicts.size > 0 };
    }

    const data = (await res.json()) as ApiValidateRoundResponse;
    if (Array.isArray(data.verdicts)) {
      for (const row of data.verdicts) {
        const original = uncached[row.id];
        if (!original) continue;
        const sanitizedReason = row.valid
          ? undefined
          : sanitizeDisplayText(row.reason, MAX_REASON_LENGTH) || undefined;
        const verdict: WordVerdict = {
          valid: Boolean(row.valid),
          reason: sanitizedReason,
        };
        const key = makeValidationKey(original.category, original.word);
        localVerdictCache.set(key, verdict);
        verdicts.set(key, verdict);
      }
      return { verdicts, usedAi: Boolean(data.usedAi) || verdicts.size > 0 };
    }

    return { verdicts, usedAi: verdicts.size > 0 };
  } catch {
    clearTimeout(timer);
    // Offline WiFi or timeout -> fall back seamlessly to Layer 1 local validator
    return { verdicts, usedAi: verdicts.size > 0 };
  }
}

export async function fetchHintViaBackend(params: {
  category: string;
  letter: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const { category, letter, timeoutMs = 3000 } = params;
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase}/v1/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': anonymousClientId,
      },
      body: JSON.stringify({
        category,
        letter: letter.toUpperCase(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as ApiHintResponse;
    const sanitizedWord = sanitizeDisplayText(data?.word, MAX_HINT_LENGTH);
    return sanitizedWord || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
