export type HintPenaltyMode = 'points' | 'lock' | 'both';

export interface GameConfig {
  categories: string[];
  allowedLetters: string[];
  timeLimitSeconds: number;
  totalRounds: number;
  validateLetter: boolean;
  aiValidation: boolean;
  hintsEnabled: boolean;
  hintPenaltyMode: HintPenaltyMode;
  hintPenaltyPoints: number;
  hintLockSeconds: number;
}

export type RoomPhase = 'lobby' | 'playing' | 'scoring' | 'results' | 'finished';

export interface PlayerInfo {
  id: string;
  name: string;
  avatarId?: string;
  avatarBg?: string;
  isHost: boolean;
  totalScore: number;
  filledCount: number;
  connected: boolean;
}

export interface RoomSnapshot {
  roomCode: string;
  hostId: string;
  phase: RoomPhase;
  config: GameConfig;
  currentRound: number;
  currentLetter: string;
  roundEndsAt: number | null;
  serverNow: number;
  serverIps: string[];
  serverPort: number;
  players: PlayerInfo[];
}

export type ScoreReason =
  | 'unique'
  | 'duplicate'
  | 'empty'
  | 'wrong_letter'
  | 'invalid';

export interface CategoryScoreEntry {
  playerId: string;
  playerName: string;
  word: string;
  points: number;
  reason: ScoreReason;
  invalidDetail?: string;
  matchedWith: string[];
}

export interface CategoryResult {
  category: string;
  entries: CategoryScoreEntry[];
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatarId?: string;
  avatarBg?: string;
  roundScore: number;
  totalScore: number;
  hintsUsed?: number;
  hintPenalty?: number;
  isHost: boolean;
  /** Standard Competition Ranking position (1, 1, 3, 4...) */
  rank?: number;
  /** True when this player pressed STOP to end the round */
  stoppedRound?: boolean;
  /** True when this player broke a points tie specifically by pressing STOP */
  wonTiebreak?: boolean;
}

export interface RoundResults {
  roundNumber: number;
  totalRounds: number;
  letter: string;
  stopReason: 'stop' | 'timeout';
  stoppedByName: string | null;
  stoppedByPlayerId?: string | null;
  categoryResults: CategoryResult[];
  roundScores: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  isFinalRound: boolean;
  validatedBy?: 'gemini' | 'local';
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'local';

// Shared API contract between apps/mobile and apps/api (Zero PII)
export interface ApiValidateWordItem {
  id: number;
  category: string;
  word: string;
  letter?: string;
}

export interface ApiValidateRoundRequest {
  items: ApiValidateWordItem[];
}

export interface ApiValidateVerdict {
  id: number;
  valid: boolean;
  reason: string;
  source: 'cache' | 'gemini' | 'local';
}

export interface ApiValidateRoundResponse {
  verdicts: ApiValidateVerdict[];
  usedAi: boolean;
}

export interface ApiHintRequest {
  category: string;
  letter: string;
}

export interface ApiHintResponse {
  word: string | null;
}
