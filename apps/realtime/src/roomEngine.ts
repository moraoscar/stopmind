import {
  ApiValidateRoundResponse,
  buildRankedLeaderboard,
  collectWordsForAiValidation,
  DEFAULT_CONFIG,
  GameConfig,
  LetterDeck,
  makeValidationKey,
  RoomPhase,
  RoomSnapshot,
  RoundResults,
  sanitizeConfig,
  scoreRoundLocal,
} from '@stopmind/shared';

export const MAX_PLAYERS_PER_ROOM = 16;
export const MAX_MESSAGE_BYTES = 16 * 1024;
const ROOM_CODE_REGEX = /^[A-Z0-9]{4,6}$/;
const AVATAR_ID_REGEX = /^[a-z0-9_]{2,24}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

export function sanitizeAvatarId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().toLowerCase();
  return AVATAR_ID_REGEX.test(cleaned) ? cleaned : undefined;
}

const AVATAR_BG_REGEX = /^[a-z0-9_]{2,16}$/;

export function sanitizeAvatarBg(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().toLowerCase();
  return AVATAR_BG_REGEX.test(cleaned) ? cleaned : undefined;
}

export function sanitizePlayerName(raw: unknown, fallback = 'Jugador'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 22);
  return cleaned || fallback;
}

export interface RoomTransport {
  sendTo(clientId: string, payload: Record<string, unknown>): void;
  broadcast(payload: Record<string, unknown>): void;
  scheduleTimer(key: 'round' | 'finalize', delayMs: number, fn: () => void): void;
  clearTimer(key: 'round' | 'finalize'): void;
  validateWords?: (
    items: { key: string; category: string; word: string; letter: string }[]
  ) => Promise<{
    verdicts: Map<string, { valid: boolean; reason?: string }>;
    usedAi: boolean;
  }>;
}

interface InternalPlayer {
  id: string;
  name: string;
  avatarId?: string;
  avatarBg?: string;
  totalScore: number;
  filledCount: number;
}

/**
 * Authoritative online room controller shared between Cloudflare Durable Objects
 * and unit tests. Speaks the exact same WebSocket JSON protocol as EmbeddedHostEngine.
 */
export class OnlineRoomEngine {
  readonly roomCode: string;
  private readonly transport: RoomTransport;

  private created = false;
  private hostId: string | null = null;
  private phase: RoomPhase = 'lobby';
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private players = new Map<string, InternalPlayer>();

  private currentRound = 0;
  private currentLetter = '';
  private letterDeck = new LetterDeck();
  private roundEndsAt: number | null = null;

  private roundAnswers: Record<string, Record<string, string>> = {};
  private roundHintsUsed: Record<string, number> = {};
  private submittedPlayers = new Set<string>();
  private stopTriggered = false;
  private finalizing = false;
  private stopReason: 'stop' | 'timeout' | null = null;
  private stoppedByName: string | null = null;
  private stoppedByPlayerId: string | null = null;
  private lastRoundResults: RoundResults | null = null;

  constructor(roomCode: string, transport: RoomTransport) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.transport = transport;
  }

  get playerCount(): number {
    return this.players.size;
  }

  handleMessage(clientId: string, rawText: string): void {
    if (rawText.length > MAX_MESSAGE_BYTES) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: 'Mensaje demasiado grande.',
      });
      return;
    }

    let msg: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return;
      }
      msg = parsed as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create_room':
        this.handleCreateRoom(clientId, msg);
        break;
      case 'join_room':
        this.handleJoinRoom(clientId, msg);
        break;
      case 'update_config':
        this.handleUpdateConfig(clientId, msg);
        break;
      case 'start_game':
        this.handleStartGame(clientId, msg);
        break;
      case 'sync_draft':
        this.handleDraft(clientId, msg);
        break;
      case 'press_stop':
        this.handlePressStop(clientId, msg);
        break;
      case 'submit_answers':
        this.handleSubmitAnswers(clientId, msg);
        break;
      case 'next_round':
        this.handleNextRound(clientId);
        break;
      case 'finish_game':
        this.handleFinishGame(clientId);
        break;
      case 'play_again':
        this.handlePlayAgain(clientId);
        break;
      case 'leave_room':
        this.handleDisconnect(clientId);
        break;
      default:
        break;
    }
  }

  handleDisconnect(clientId: string): void {
    if (!this.players.has(clientId)) return;
    this.players.delete(clientId);
    this.submittedPlayers.delete(clientId);

    if (this.players.size === 0) {
      this.resetRoom();
      return;
    }

    if (this.hostId === clientId) {
      const nextHost = this.players.keys().next().value;
      this.hostId = nextHost ?? null;
    }

    this.emitRoomState();

    if (
      this.phase === 'scoring' &&
      !this.finalizing &&
      this.submittedPlayers.size >= this.players.size
    ) {
      void this.finalizeRound();
    }
  }

  private resetRoom(): void {
    this.transport.clearTimer('round');
    this.transport.clearTimer('finalize');
    this.created = false;
    this.hostId = null;
    this.phase = 'lobby';
    this.currentRound = 0;
    this.currentLetter = '';
    this.roundEndsAt = null;
    this.roundAnswers = {};
    this.roundHintsUsed = {};
    this.submittedPlayers.clear();
    this.stopTriggered = false;
    this.finalizing = false;
    this.stopReason = null;
    this.stoppedByName = null;
    this.stoppedByPlayerId = null;
    this.lastRoundResults = null;
  }

  private handleCreateRoom(clientId: string, msg: Record<string, unknown>): void {
    if (this.created && this.players.size > 0 && this.hostId !== clientId) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: 'Esa sala ya está en uso. Intenta crear otra.',
      });
      return;
    }

    const name = sanitizePlayerName(msg.playerName, 'Anfitrión');
    const avatarId = sanitizeAvatarId(msg.avatarId);
    const avatarBg = sanitizeAvatarBg(msg.avatarBg);
    if (msg.config && typeof msg.config === 'object') {
      this.config = sanitizeConfig(msg.config as Partial<GameConfig>);
    }

    this.created = true;
    this.hostId = clientId;
    this.phase = 'lobby';
    this.players.set(clientId, {
      id: clientId,
      name,
      avatarId,
      avatarBg,
      totalScore: 0,
      filledCount: 0,
    });

    const snapshot = this.buildSnapshot();
    this.transport.sendTo(clientId, {
      type: 'joined',
      playerId: clientId,
      room: snapshot,
    });
    this.emitRoomState();
  }

  private handleJoinRoom(clientId: string, msg: Record<string, unknown>): void {
    if (!this.created || this.players.size === 0) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: `No se encontró la sala "${this.roomCode}". Verifica el código con el anfitrión.`,
      });
      return;
    }

    const reqCode =
      typeof msg.roomCode === 'string'
        ? msg.roomCode.trim().toUpperCase()
        : this.roomCode;
    if (reqCode && reqCode !== this.roomCode) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: `El código "${reqCode}" no coincide con esta sala.`,
      });
      return;
    }

    if (this.phase !== 'lobby' && !this.players.has(clientId)) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: 'La partida ya está en curso. Espera a que termine la ronda.',
      });
      return;
    }

    if (!this.players.has(clientId) && this.players.size >= MAX_PLAYERS_PER_ROOM) {
      this.transport.sendTo(clientId, {
        type: 'error',
        message: `La sala alcanzó el límite de ${MAX_PLAYERS_PER_ROOM} jugadores.`,
      });
      return;
    }

    const name = sanitizePlayerName(msg.playerName, 'Jugador');
    const avatarId = sanitizeAvatarId(msg.avatarId);
    const avatarBg = sanitizeAvatarBg(msg.avatarBg);
    const existing = this.players.get(clientId);
    this.players.set(clientId, {
      id: clientId,
      name,
      avatarId: avatarId ?? existing?.avatarId,
      avatarBg: avatarBg ?? existing?.avatarBg,
      totalScore: existing?.totalScore ?? 0,
      filledCount: existing?.filledCount ?? 0,
    });

    const snapshot = this.buildSnapshot();
    this.transport.sendTo(clientId, {
      type: 'joined',
      playerId: clientId,
      room: snapshot,
    });
    this.emitRoomState();
  }

  private handleUpdateConfig(clientId: string, msg: Record<string, unknown>): void {
    if (clientId !== this.hostId || this.phase !== 'lobby') return;
    if (!msg.config || typeof msg.config !== 'object') return;
    this.config = sanitizeConfig(msg.config as Partial<GameConfig>);
    this.emitRoomState();
  }

  private handleStartGame(clientId: string, msg: Record<string, unknown>): void {
    if (clientId !== this.hostId) return;
    if (msg.config && typeof msg.config === 'object') {
      this.config = sanitizeConfig(msg.config as Partial<GameConfig>);
    }
    this.currentRound = 0;
    this.lastRoundResults = null;
    for (const p of this.players.values()) {
      p.totalScore = 0;
      p.filledCount = 0;
    }
    this.startRound();
  }

  private handleNextRound(clientId: string): void {
    if (clientId !== this.hostId) return;
    if (this.phase !== 'results') return;
    if (this.currentRound >= this.config.totalRounds) return;
    this.startRound();
  }

  private handleFinishGame(clientId: string): void {
    if (clientId !== this.hostId) return;
    if (this.phase !== 'results' && this.phase !== 'playing') return;

    this.transport.clearTimer('round');
    this.transport.clearTimer('finalize');
    this.phase = 'finished';
    this.roundEndsAt = null;
    this.stopTriggered = true;
    this.finalizing = false;

    const finalResults: RoundResults = this.lastRoundResults
      ? {
          ...this.lastRoundResults,
          isFinalRound: true,
        }
      : {
          roundNumber: Math.max(1, this.currentRound),
          totalRounds: this.config.totalRounds,
          letter: this.currentLetter || '—',
          stopReason: 'timeout',
          stoppedByName: null,
          stoppedByPlayerId: null,
          categoryResults: [],
          roundScores: Object.fromEntries(
            [...this.players.values()].map((p) => [p.id, 0])
          ),
          leaderboard: buildRankedLeaderboard({
            entries: [...this.players.values()].map((p) => ({
              playerId: p.id,
              playerName: p.name,
              ...(p.avatarId ? { avatarId: p.avatarId } : {}),
              ...(p.avatarBg ? { avatarBg: p.avatarBg } : {}),
              roundScore: 0,
              totalScore: p.totalScore,
              hintsUsed: 0,
              hintPenalty: 0,
              isHost: p.id === this.hostId,
            })),
            stopReason: 'timeout',
            stoppedByPlayerId: null,
          }),
          isFinalRound: true,
          validatedBy: 'local',
        };

    this.lastRoundResults = finalResults;
    this.emitRoomState();
    this.transport.broadcast({
      type: 'round_results',
      results: finalResults,
    });
  }

  private handlePlayAgain(clientId: string): void {
    if (clientId !== this.hostId) return;
    this.transport.clearTimer('round');
    this.transport.clearTimer('finalize');
    this.phase = 'lobby';
    this.currentRound = 0;
    this.currentLetter = '';
    this.lastRoundResults = null;
    this.roundEndsAt = null;
    for (const p of this.players.values()) {
      p.totalScore = 0;
      p.filledCount = 0;
    }
    this.emitRoomState();
  }

  private startRound(): void {
    this.transport.clearTimer('round');
    this.transport.clearTimer('finalize');

    this.currentRound += 1;
    this.currentLetter = this.letterDeck.draw(this.config.allowedLetters);
    this.phase = 'playing';
    this.roundAnswers = {};
    this.roundHintsUsed = {};
    this.submittedPlayers.clear();
    this.stopTriggered = false;
    this.finalizing = false;
    this.stopReason = null;
    this.stoppedByName = null;
    this.stoppedByPlayerId = null;

    for (const p of this.players.values()) {
      p.filledCount = 0;
      this.roundAnswers[p.id] = {};
      this.roundHintsUsed[p.id] = 0;
    }

    const now = Date.now();
    const durationMs = this.config.timeLimitSeconds * 1000;
    this.roundEndsAt = now + durationMs;

    this.emitRoomState();

    this.transport.broadcast({
      type: 'round_started',
      roundNumber: this.currentRound,
      totalRounds: this.config.totalRounds,
      letter: this.currentLetter,
      durationSeconds: this.config.timeLimitSeconds,
      serverNow: now,
      endsAt: this.roundEndsAt,
    });

    this.transport.scheduleTimer('round', durationMs + 250, () => {
      this.triggerRoundStop({
        reason: 'timeout',
        stoppedByName: null,
        stoppedByPlayerId: null,
      });
    });
  }

  private extractAnswers(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const cat of this.config.categories) {
      const val = (raw as Record<string, unknown>)[cat];
      if (typeof val === 'string') {
        out[cat] = val.slice(0, 64);
      }
    }
    return out;
  }

  private handleDraft(clientId: string, msg: Record<string, unknown>): void {
    if (this.phase !== 'playing' && this.phase !== 'scoring') return;
    const player = this.players.get(clientId);
    if (!player) return;

    const answers = this.extractAnswers(msg.answers);
    this.roundAnswers[clientId] = answers;
    if (typeof msg.hintsUsed === 'number' && Number.isFinite(msg.hintsUsed)) {
      this.roundHintsUsed[clientId] = Math.max(
        this.roundHintsUsed[clientId] ?? 0,
        Math.min(50, Math.floor(msg.hintsUsed))
      );
    }

    const filled = this.config.categories.filter(
      (cat) => typeof answers[cat] === 'string' && answers[cat].trim().length > 0
    ).length;

    if (player.filledCount !== filled) {
      player.filledCount = filled;
      this.emitRoomState();
    }
  }

  private handlePressStop(clientId: string, msg: Record<string, unknown>): void {
    if (this.phase !== 'playing') return;
    const player = this.players.get(clientId);
    if (!player) return;

    if (msg.answers) {
      this.roundAnswers[clientId] = this.extractAnswers(msg.answers);
    }
    if (typeof msg.hintsUsed === 'number' && Number.isFinite(msg.hintsUsed)) {
      this.roundHintsUsed[clientId] = Math.max(
        this.roundHintsUsed[clientId] ?? 0,
        Math.min(50, Math.floor(msg.hintsUsed))
      );
    }
    this.submittedPlayers.add(clientId);

    this.triggerRoundStop({
      reason: 'stop',
      stoppedByName: player.name,
      stoppedByPlayerId: player.id,
    });
  }

  private handleSubmitAnswers(
    clientId: string,
    msg: Record<string, unknown>
  ): void {
    if (this.phase !== 'playing' && this.phase !== 'scoring') return;
    if (!this.players.has(clientId)) return;

    this.roundAnswers[clientId] = this.extractAnswers(msg.answers);
    if (typeof msg.hintsUsed === 'number' && Number.isFinite(msg.hintsUsed)) {
      this.roundHintsUsed[clientId] = Math.max(
        this.roundHintsUsed[clientId] ?? 0,
        Math.min(50, Math.floor(msg.hintsUsed))
      );
    }
    this.submittedPlayers.add(clientId);

    if (
      this.phase === 'scoring' &&
      !this.finalizing &&
      this.submittedPlayers.size >= this.players.size
    ) {
      void this.finalizeRound();
    }
  }

  private triggerRoundStop(params: {
    reason: 'stop' | 'timeout';
    stoppedByName: string | null;
    stoppedByPlayerId: string | null;
  }): void {
    if (this.phase !== 'playing' || this.stopTriggered) return;
    this.stopTriggered = true;
    this.stopReason = params.reason;
    this.stoppedByName = params.stoppedByName;
    this.stoppedByPlayerId = params.stoppedByPlayerId;
    this.phase = 'scoring';
    this.transport.clearTimer('round');

    this.transport.broadcast({
      type: 'force_stop',
      reason: params.reason,
      stoppedByName: params.stoppedByName,
      stoppedByPlayerId: params.stoppedByPlayerId,
    });

    if (this.submittedPlayers.size >= this.players.size) {
      void this.finalizeRound();
    } else {
      this.transport.scheduleTimer('finalize', 1200, () => {
        void this.finalizeRound();
      });
    }
  }

  private async finalizeRound(): Promise<void> {
    if (this.phase !== 'scoring' || this.finalizing) return;
    this.finalizing = true;
    this.transport.clearTimer('round');
    this.transport.clearTimer('finalize');

    const playerList = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
    }));

    let aiVerdicts: Map<string, { valid: boolean; reason?: string }> | undefined;
    let usedAi = false;

    if (this.config.aiValidation && this.transport.validateWords) {
      const items = collectWordsForAiValidation({
        categories: this.config.categories,
        letter: this.currentLetter,
        validateLetter: this.config.validateLetter,
        players: playerList,
        answersByPlayer: this.roundAnswers,
      });
      if (items.length > 0) {
        try {
          const aiRes = await this.transport.validateWords(items);
          aiVerdicts = aiRes.verdicts;
          usedAi = aiRes.usedAi;
        } catch {
          // Graceful fallback to Layer 1 local validation
        }
      }
    }

    if (this.phase !== 'scoring') {
      this.finalizing = false;
      return;
    }

    const hintPoints =
      this.config.hintsEnabled &&
      (this.config.hintPenaltyMode === 'points' ||
        this.config.hintPenaltyMode === 'both')
        ? this.config.hintPenaltyPoints
        : 0;

    const { categoryResults, roundScores, hintPenalties } = scoreRoundLocal({
      categories: this.config.categories,
      letter: this.currentLetter,
      validateLetter: this.config.validateLetter,
      players: playerList,
      answersByPlayer: this.roundAnswers,
      aiVerdicts,
      hintsUsedByPlayer: this.roundHintsUsed,
      hintPenaltyPoints: hintPoints,
    });

    for (const p of this.players.values()) {
      p.totalScore += roundScores[p.id] ?? 0;
    }

    const isFinalRound = this.currentRound >= this.config.totalRounds;
    this.phase = isFinalRound ? 'finished' : 'results';
    this.finalizing = false;

    const stopReason = this.stopReason ?? 'timeout';
    const leaderboard = buildRankedLeaderboard({
      entries: [...this.players.values()].map((p) => ({
        playerId: p.id,
        playerName: p.name,
        ...(p.avatarId ? { avatarId: p.avatarId } : {}),
        ...(p.avatarBg ? { avatarBg: p.avatarBg } : {}),
        roundScore: roundScores[p.id] ?? 0,
        totalScore: p.totalScore,
        hintsUsed: this.roundHintsUsed[p.id] ?? 0,
        hintPenalty: hintPenalties[p.id] ?? 0,
        isHost: p.id === this.hostId,
      })),
      stopReason,
      stoppedByPlayerId: this.stoppedByPlayerId,
    });

    const results: RoundResults = {
      roundNumber: this.currentRound,
      totalRounds: this.config.totalRounds,
      letter: this.currentLetter,
      stopReason,
      stoppedByName: this.stoppedByName,
      stoppedByPlayerId: this.stoppedByPlayerId,
      categoryResults,
      roundScores,
      leaderboard,
      isFinalRound,
      validatedBy: usedAi ? 'gemini' : 'local',
    };

    this.lastRoundResults = results;
    this.emitRoomState();
    this.transport.broadcast({
      type: 'round_results',
      results,
    });
  }

  private buildSnapshot(): RoomSnapshot {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId ?? '',
      phase: this.phase,
      config: this.config,
      currentRound: this.currentRound,
      currentLetter: this.currentLetter,
      roundEndsAt: this.roundEndsAt,
      serverNow: Date.now(),
      serverIps: [],
      serverPort: 443,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.avatarId ? { avatarId: p.avatarId } : {}),
        ...(p.avatarBg ? { avatarBg: p.avatarBg } : {}),
        isHost: p.id === this.hostId,
        totalScore: p.totalScore,
        filledCount: p.filledCount,
        connected: true,
      })),
    };
  }

  private emitRoomState(): void {
    this.transport.broadcast({
      type: 'room_state',
      room: this.buildSnapshot(),
    });
  }
}

export async function validateRoundViaAwsApi(params: {
  apiBaseUrl: string;
  items: { key: string; category: string; word: string; letter: string }[];
  timeoutMs?: number;
}): Promise<{
  verdicts: Map<string, { valid: boolean; reason?: string }>;
  usedAi: boolean;
}> {
  const { apiBaseUrl, items, timeoutMs = 5500 } = params;
  const verdicts = new Map<string, { valid: boolean; reason?: string }>();
  const base = apiBaseUrl.trim().replace(/\/+$/, '');
  if (!base || items.length === 0) {
    return { verdicts, usedAi: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/v1/validate-round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': 'sm_cf_realtime',
      },
      body: JSON.stringify({
        items: items.slice(0, 20).map((item, id) => ({
          id,
          category: item.category,
          word: item.word,
          letter: item.letter ? item.letter.toUpperCase() : undefined,
        })),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { verdicts, usedAi: false };

    const data = (await res.json()) as ApiValidateRoundResponse;
    if (Array.isArray(data.verdicts)) {
      for (const row of data.verdicts) {
        const original = items[row.id];
        if (!original) continue;
        const key = makeValidationKey(original.category, original.word);
        verdicts.set(key, {
          valid: Boolean(row.valid),
          reason: row.valid ? undefined : row.reason || undefined,
        });
      }
      return { verdicts, usedAi: Boolean(data.usedAi) || verdicts.size > 0 };
    }
    return { verdicts, usedAi: false };
  } catch {
    clearTimeout(timer);
    return { verdicts, usedAi: false };
  }
}
