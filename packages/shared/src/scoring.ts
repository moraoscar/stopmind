import {
  CategoryResult,
  CategoryScoreEntry,
  LeaderboardEntry,
  ScoreReason,
} from './types';
import { canonicalizeInput, validateWordLocally } from './wordValidator';

export function normalizeWord(raw: string): string {
  if (!raw) return '';
  return canonicalizeInput(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeValidationKey(category: string, word: string): string {
  return `${normalizeWord(category)}::${normalizeWord(word)}`;
}

export function phoneticKey(normalized: string): string {
  if (!normalized) return '';
  let s = normalized.replace(/\s+/g, '');
  s = s.replace(/(?<!c)h/g, '');
  s = s.replace(/ll/g, 'y');
  s = s.replace(/v/g, 'b');
  s = s.replace(/z/g, 's');
  s = s.replace(/c([ei])/g, 's$1');
  s = s.replace(/qu/g, 'k');
  s = s.replace(/c/g, 'k');
  s = s.replace(/g([ei])/g, 'j$1');
  s = s.replace(/w/g, 'u');
  // Preserve Spanish "rr" (perro != pero, carro != caro); collapse other accidental doubles
  s = s.replace(/([^r])\1+/g, '$1');
  s = s.replace(/r{3,}/g, 'rr');
  return s;
}

export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        best = Math.min(best, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = best;
    }
  }
  return dp[m][n];
}

/**
 * Determines whether two answers represent the SAME word (duplicate -> 50 pts)
 * vs. two distinct words (unique -> 100 pts).
 *
 * Intentionally strict to prevent false positives on distinct Spanish words, names,
 * and surnames that differ by 1-2 letters (e.g. "Frías" vs "Farías", "María" vs "Mario",
 * "Daniel" vs "Daniela", "Sofía" vs "Sonia", "Rojas" vs "Rosas", "Pérez" vs "Páez").
 */
export function areWordsSimilar(rawA: string, rawB: string): boolean {
  const a = normalizeWord(rawA);
  const b = normalizeWord(rawB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Exact Spanish phonetic/orthographic twin (e.g. Gómez/Gomes, Jirafa/Girafa, Ballena/Bayena)
  const pa = phoneticKey(a);
  const pb = phoneticKey(b);
  if (pa.length >= 2 && pa === pb) return true;

  // Only allow a single adjacent-letter transposition typo on long words (>= 7 chars)
  // e.g. "Manzana" vs "Manazna", "Colombia" vs "Colomiba"
  if (a.length >= 7 && a.length === b.length) {
    const dist = damerauLevenshtein(a, b);
    if (
      dist === 1 &&
      a.split('').sort().join('') === b.split('').sort().join('')
    ) {
      return true;
    }
  }

  return false;
}

export function startsWithLetter(rawWord: string, letter: string): boolean {
  const normalized = normalizeWord(rawWord);
  const target = normalizeWord(letter);
  if (!normalized || !target) return false;
  return normalized.startsWith(target);
}

export function collectWordsForAiValidation(params: {
  categories: string[];
  letter: string;
  validateLetter: boolean;
  players: { id: string; name: string }[];
  answersByPlayer: Record<string, Record<string, string>>;
}): { key: string; category: string; word: string; letter: string }[] {
  const { categories, letter, validateLetter, players, answersByPlayer } = params;
  const items: { key: string; category: string; word: string; letter: string }[] = [];
  const seen = new Set<string>();

  for (const category of categories) {
    for (const player of players) {
      const trimmed = canonicalizeInput(answersByPlayer[player.id]?.[category] ?? '');
      const normalized = normalizeWord(trimmed);
      if (!normalized) continue;
      if (validateLetter && letter && !startsWithLetter(trimmed, letter)) continue;
      if (!validateWordLocally(trimmed).valid) continue;

      const key = makeValidationKey(category, trimmed);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ key, category, word: trimmed, letter });
      }
    }
  }
  return items;
}

export function scoreRoundLocal(params: {
  categories: string[];
  letter: string;
  validateLetter: boolean;
  players: { id: string; name: string }[];
  answersByPlayer: Record<string, Record<string, string>>;
  aiVerdicts?: Map<string, { valid: boolean; reason?: string }>;
  hintsUsedByPlayer?: Record<string, number>;
  hintPenaltyPoints?: number;
}): {
  categoryResults: CategoryResult[];
  roundScores: Record<string, number>;
  hintPenalties: Record<string, number>;
} {
  const {
    categories,
    letter,
    validateLetter,
    players,
    answersByPlayer,
    aiVerdicts,
    hintsUsedByPlayer = {},
    hintPenaltyPoints = 0,
  } = params;
  const roundScores: Record<string, number> = {};
  const hintPenalties: Record<string, number> = {};
  for (const player of players) {
    roundScores[player.id] = 0;
    hintPenalties[player.id] = 0;
  }

  const categoryResults: CategoryResult[] = categories.map((category) => {
    const entries = players.map((player) => {
      const raw = answersByPlayer[player.id]?.[category] ?? '';
      const trimmed = canonicalizeInput(raw);
      const normalized = normalizeWord(trimmed);
      let status: 'valid' | 'empty' | 'wrong_letter' | 'invalid' = 'valid';
      let invalidDetail: string | undefined;

      if (!normalized) {
        status = 'empty';
      } else if (validateLetter && letter && !startsWithLetter(trimmed, letter)) {
        status = 'wrong_letter';
      } else {
        const localCheck = validateWordLocally(trimmed);
        if (!localCheck.valid) {
          status = 'invalid';
          invalidDetail = localCheck.reason;
        } else if (aiVerdicts) {
          const key = makeValidationKey(category, trimmed);
          const aiVerdict = aiVerdicts.get(key);
          if (aiVerdict && !aiVerdict.valid) {
            status = 'invalid';
            invalidDetail =
              aiVerdict.reason || `No corresponde a ${category}`;
          }
        }
      }

      return {
        playerId: player.id,
        playerName: player.name,
        word: trimmed,
        status,
        invalidDetail,
      };
    });

    const validIndices = entries
      .map((entry, idx) => (entry.status === 'valid' ? idx : -1))
      .filter((idx) => idx !== -1);

    const parent = validIndices.map((_, i) => i);
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    for (let i = 0; i < validIndices.length; i++) {
      for (let j = i + 1; j < validIndices.length; j++) {
        if (
          areWordsSimilar(
            entries[validIndices[i]].word,
            entries[validIndices[j]].word
          )
        ) {
          union(i, j);
        }
      }
    }

    const clusters = new Map<number, number[]>();
    for (let i = 0; i < validIndices.length; i++) {
      const root = find(i);
      const list = clusters.get(root) ?? [];
      list.push(validIndices[i]);
      clusters.set(root, list);
    }

    const entryClusterMap = new Map<number, number[]>();
    for (const members of clusters.values()) {
      for (const idx of members) {
        entryClusterMap.set(idx, members);
      }
    }

    const scoredEntries: CategoryScoreEntry[] = entries.map((entry, idx) => {
      if (
        entry.status === 'empty' ||
        entry.status === 'wrong_letter' ||
        entry.status === 'invalid'
      ) {
        const reason: ScoreReason = entry.status;
        return {
          playerId: entry.playerId,
          playerName: entry.playerName,
          word: entry.word,
          points: 0,
          reason,
          invalidDetail: entry.invalidDetail,
          matchedWith: [],
        };
      }

      const cluster = entryClusterMap.get(idx) ?? [idx];
      if (cluster.length > 1) {
        const matchedWith = cluster
          .filter((memberIdx) => memberIdx !== idx)
          .map((memberIdx) => entries[memberIdx].playerName);
        roundScores[entry.playerId] += 50;
        return {
          playerId: entry.playerId,
          playerName: entry.playerName,
          word: entry.word,
          points: 50,
          reason: 'duplicate',
          matchedWith,
        };
      }

      roundScores[entry.playerId] += 100;
      return {
        playerId: entry.playerId,
        playerName: entry.playerName,
        word: entry.word,
        points: 100,
        reason: 'unique',
        matchedWith: [],
      };
    });

    return { category, entries: scoredEntries };
  });

  if (hintPenaltyPoints > 0) {
    for (const player of players) {
      const count = Math.max(0, Math.floor(hintsUsedByPlayer[player.id] ?? 0));
      const penalty = count * hintPenaltyPoints;
      hintPenalties[player.id] = penalty;
      roundScores[player.id] = Math.max(0, roundScores[player.id] - penalty);
    }
  }

  return { categoryResults, roundScores, hintPenalties };
}

export interface LeaderboardRankInput {
  playerId: string;
  playerName: string;
  roundScore: number;
  totalScore: number;
  hintsUsed?: number;
  hintPenalty?: number;
  isHost: boolean;
}

/**
 * Builds a fair leaderboard using Standard Competition Ranking (1, 1, 3, 4...):
 * 1. Higher `totalScore` always ranks higher.
 * 2. If two or more players have the exact same `totalScore`, whoever pressed STOP
 *    in this round wins the tiebreak and ranks ahead of the other tied players.
 * 3. Players with the exact same `totalScore` where none pressed STOP share the
 *    exact same `rank`, and the next distinct rank skips accordingly (e.g. 1, 1, 3).
 * Host status NEVER influences tiebreaks.
 */
export function buildRankedLeaderboard(params: {
  entries: LeaderboardRankInput[];
  stopReason: 'stop' | 'timeout';
  stoppedByPlayerId: string | null;
}): LeaderboardEntry[] {
  const { entries, stopReason, stoppedByPlayerId } = params;
  const activeStopperId =
    stopReason === 'stop' && stoppedByPlayerId ? stoppedByPlayerId : null;

  // Count how many players share each totalScore to detect real STOP tiebreaks
  const scoreCounts = new Map<number, number>();
  for (const e of entries) {
    scoreCounts.set(e.totalScore, (scoreCounts.get(e.totalScore) ?? 0) + 1);
  }

  const enriched: LeaderboardEntry[] = entries.map((e) => {
    const stoppedRound = Boolean(activeStopperId && e.playerId === activeStopperId);
    const hasScoreTie = (scoreCounts.get(e.totalScore) ?? 0) > 1;
    return {
      ...e,
      stoppedRound,
      wonTiebreak: stoppedRound && hasScoreTie,
    };
  });

  enriched.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    const stopA = a.stoppedRound ? 1 : 0;
    const stopB = b.stoppedRound ? 1 : 0;
    if (stopB !== stopA) {
      return stopB - stopA;
    }
    return a.playerName.localeCompare(b.playerName, 'es', { sensitivity: 'base' });
  });

  for (let i = 0; i < enriched.length; i++) {
    if (i === 0) {
      enriched[i].rank = 1;
    } else {
      const prev = enriched[i - 1];
      const curr = enriched[i];
      const isTiedWithPrev =
        curr.totalScore === prev.totalScore &&
        Boolean(curr.stoppedRound) === Boolean(prev.stoppedRound);
      curr.rank = isTiedWithPrev ? prev.rank : i + 1;
    }
  }

  return enriched;
}
