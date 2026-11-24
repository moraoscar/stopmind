import { EventSubscription } from 'expo-modules-core';
import {
  getLanServerNativeModule,
  LanServerStartResult,
} from '../../modules/lan-server';
import {
  buildRankedLeaderboard,
  collectWordsForAiValidation,
  DEFAULT_SERVER_PORT,
  GameConfig,
  LetterDeck,
  RoomPhase,
  RoomSnapshot,
  RoundResults,
  sanitizeConfig,
  scoreRoundLocal,
} from '@stopmind/shared';
import { validateRoundViaBackend } from '../utils/apiValidator';
import {
  canonicalizeRoomCode,
  MAX_LAN_MESSAGE_BYTES,
  MAX_LAN_PLAYERS,
  MAX_PLAYER_NAME_LENGTH,
  sanitizeAvatarBg,
  sanitizeAvatarId,
  sanitizeDisplayText,
  sanitizeIncomingAnswers,
} from '../utils/security';

export interface EmbeddedHostCallbacks {
  onRoomState: (room: RoomSnapshot) => void;
  onRoundStarted: (payload: {
    roundNumber: number;
    totalRounds: number;
    letter: string;
    durationSeconds: number;
    serverNow: number;
    endsAt: number;
  }) => void;
  onForceStop: (payload: {
    reason: 'stop' | 'timeout';
    stoppedByName: string | null;
    stoppedByPlayerId: string | null;
  }) => void;
  onRoundResults: (results: RoundResults) => void;
}

interface InternalPlayer {
  id: string;
  clientId: string | null; // null = local host phone
  name: string;
  avatarId?: string;
  avatarBg?: string;
  totalScore: number;
  filledCount: number;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Runs the authoritative STOP! multiplayer room engine directly on the Host phone
 * using the embedded native LanServer WebSocket module (no Mac/PC or internet required).
 */
export class EmbeddedHostEngine {
  private callbacks: EmbeddedHostCallbacks;
  private subs: EventSubscription[] = [];
  private running = false;

  private roomCode = '';
  private hostId = 'host_local';
  private phase: RoomPhase = 'lobby';
  private config: GameConfig;
  private serverIps: string[] = [];
  private serverPort: number = DEFAULT_SERVER_PORT;

  private players = new Map<string, InternalPlayer>();
  private clientToPlayerId = new Map<string, string>();

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

  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private finalizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    hostName: string,
    initialConfig: GameConfig,
    callbacks: EmbeddedHostCallbacks,
    hostAvatarId?: string,
    hostAvatarBg?: string
  ) {
    this.callbacks = callbacks;
    this.config = sanitizeConfig(initialConfig);
    this.roomCode = generateRoomCode();
    this.players.set(this.hostId, {
      id: this.hostId,
      clientId: null,
      name: hostName.trim().slice(0, 24) || 'Anfitrión',
      avatarId: sanitizeAvatarId(hostAvatarId),
      avatarBg: sanitizeAvatarBg(hostAvatarBg),
      totalScore: 0,
      filledCount: 0,
    });
  }

  async start(preferredPort = DEFAULT_SERVER_PORT): Promise<{
    playerId: string;
    room: RoomSnapshot;
    serverInfo: LanServerStartResult;
  }> {
    const native = getLanServerNativeModule();
    if (!native) {
      throw new Error('Módulo nativo LanServer no disponible.');
    }

    this.detachListeners();
    this.subs.push(
      native.addListener('onMessage', ({ clientId, message }) => {
        this.handleClientMessage(clientId, message);
      }),
      native.addListener('onClientDisconnected', ({ clientId }) => {
        this.handleClientDisconnected(clientId);
      })
    );

    const hostName = this.players.get(this.hostId)?.name ?? 'Anfitrión';
    const serverInfo = await native.startServer(
      preferredPort,
      this.roomCode,
      hostName
    );
    this.running = true;
    this.serverIps = serverInfo.ips.length > 0 ? serverInfo.ips : [serverInfo.ip];
    this.serverPort = serverInfo.port;

    const snapshot = this.buildSnapshot();
    this.callbacks.onRoomState(snapshot);

    return {
      playerId: this.hostId,
      room: snapshot,
      serverInfo,
    };
  }

  stop(): void {
    this.clearTimers();
    this.detachListeners();
    if (this.running) {
      this.running = false;
      getLanServerNativeModule()?.stopServer();
    }
    this.players.clear();
    this.clientToPlayerId.clear();
    this.lastRoundResults = null;
  }

  updateHostName(name: string): void {
    const host = this.players.get(this.hostId);
    if (!host) return;
    host.name = name.trim().slice(0, 24) || 'Anfitrión';
    this.emitRoomState();
  }

  updateHostAvatar(avatarId: string): void {
    const host = this.players.get(this.hostId);
    if (!host) return;
    host.avatarId = sanitizeAvatarId(avatarId);
    this.emitRoomState();
  }

  updateHostAvatarBg(avatarBg: string): void {
    const host = this.players.get(this.hostId);
    if (!host) return;
    host.avatarBg = sanitizeAvatarBg(avatarBg);
    this.emitRoomState();
  }

  updateConfig(nextConfig: GameConfig): void {
    if (this.phase !== 'lobby') return;
    this.config = sanitizeConfig(nextConfig);
    this.emitRoomState();
  }

  startGame(overrideConfig?: GameConfig): void {
    if (overrideConfig) {
      this.config = sanitizeConfig(overrideConfig);
    }
    this.currentRound = 0;
    this.lastRoundResults = null;
    // Keep letterDeck intact across consecutive matches so letters rotate cleanly without repeating!
    for (const p of this.players.values()) {
      p.totalScore = 0;
      p.filledCount = 0;
    }
    this.startRound();
  }

  syncHostDraft(answers: Record<string, string>, hintsUsed?: number): void {
    this.handleDraft(this.hostId, answers, hintsUsed);
  }

  pressHostStop(answers: Record<string, string>, hintsUsed?: number): void {
    this.handlePressStop(this.hostId, answers, hintsUsed);
  }

  nextRound(): void {
    if (this.phase !== 'results') return;
    if (this.currentRound >= this.config.totalRounds) return;
    this.startRound();
  }

  finishGame(): void {
    if (this.phase !== 'results' && this.phase !== 'playing') return;
    this.clearTimers();
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
    this.callbacks.onRoundResults(finalResults);
    this.broadcastToGuests({
      type: 'round_results',
      results: finalResults,
    });
  }

  playAgain(): void {
    this.clearTimers();
    this.phase = 'lobby';
    this.currentRound = 0;
    this.currentLetter = '';
    this.lastRoundResults = null;
    // Keep letterDeck intact so consecutive matches continue rotating fresh letters
    this.roundEndsAt = null;
    for (const p of this.players.values()) {
      p.totalScore = 0;
      p.filledCount = 0;
    }
    this.emitRoomState();
  }

  private detachListeners(): void {
    for (const sub of this.subs) {
      sub.remove();
    }
    this.subs = [];
  }

  private clearTimers(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.finalizeTimer) {
      clearTimeout(this.finalizeTimer);
      this.finalizeTimer = null;
    }
  }

  private sendToGuest(clientId: string, payload: Record<string, unknown>): void {
    getLanServerNativeModule()?.sendToClient(clientId, JSON.stringify(payload));
  }

  private broadcastToGuests(payload: Record<string, unknown>): void {
    getLanServerNativeModule()?.broadcast(JSON.stringify(payload));
  }

  private buildSnapshot(): RoomSnapshot {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      phase: this.phase,
      config: this.config,
      currentRound: this.currentRound,
      currentLetter: this.currentLetter,
      roundEndsAt: this.roundEndsAt,
      serverNow: Date.now(),
      serverIps: this.serverIps,
      serverPort: this.serverPort,
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
    const snapshot = this.buildSnapshot();
    this.callbacks.onRoomState(snapshot);
    this.broadcastToGuests({ type: 'room_state', room: snapshot });
  }

  private pickNextLetter(): string {
    return this.letterDeck.draw(this.config.allowedLetters);
  }

  private startRound(): void {
    this.clearTimers();
    this.currentRound += 1;
    this.currentLetter = this.pickNextLetter();
    this.phase = 'playing';
    this.roundAnswers = {};
    this.roundHintsUsed = {};
    this.submittedPlayers = new Set();
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

    const roundStartedPayload = {
      roundNumber: this.currentRound,
      totalRounds: this.config.totalRounds,
      letter: this.currentLetter,
      durationSeconds: this.config.timeLimitSeconds,
      serverNow: now,
      endsAt: this.roundEndsAt,
    };

    this.callbacks.onRoundStarted(roundStartedPayload);
    this.broadcastToGuests({
      type: 'round_started',
      ...roundStartedPayload,
    });

    this.roundTimer = setTimeout(() => {
      this.triggerRoundStop({
        reason: 'timeout',
        stoppedByName: null,
        stoppedByPlayerId: null,
      });
    }, durationMs + 150);
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

    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    // Host already has its latest draft in roundAnswers
    this.submittedPlayers.add(this.hostId);

    this.callbacks.onForceStop(params);
    this.broadcastToGuests({
      type: 'force_stop',
      reason: params.reason,
      stoppedByName: params.stoppedByName,
      stoppedByPlayerId: params.stoppedByPlayerId,
    });

    if (this.submittedPlayers.size >= this.players.size) {
      void this.finalizeRound();
    } else {
      this.finalizeTimer = setTimeout(() => {
        void this.finalizeRound();
      }, 850);
    }
  }

  private async finalizeRound(): Promise<void> {
    if (this.phase !== 'scoring' || this.finalizing) return;
    this.finalizing = true;
    this.clearTimers();

    const playerList = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
    }));

    let aiVerdicts: Map<string, { valid: boolean; reason?: string }> | undefined;
    let usedAi = false;

    if (this.config.aiValidation) {
      const items = collectWordsForAiValidation({
        categories: this.config.categories,
        letter: this.currentLetter,
        validateLetter: this.config.validateLetter,
        players: playerList,
        answersByPlayer: this.roundAnswers,
      });
      if (items.length > 0) {
        const aiRes = await validateRoundViaBackend({ items });
        aiVerdicts = aiRes.verdicts;
        usedAi = aiRes.usedAi;
      }
    }

    // Abort if room was stopped/reset while awaiting Gemini
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
    this.callbacks.onRoundResults(results);
    this.broadcastToGuests({
      type: 'round_results',
      results,
    });
  }

  private handleDraft(
    playerId: string,
    answers: Record<string, string>,
    hintsUsed?: number
  ): void {
    if (this.phase !== 'playing' && this.phase !== 'scoring') return;
    const player = this.players.get(playerId);
    if (!player) return;

    const cleanAnswers = sanitizeIncomingAnswers(answers, this.config.categories);
    this.roundAnswers[playerId] = cleanAnswers;
    if (typeof hintsUsed === 'number' && Number.isFinite(hintsUsed)) {
      const clampedHints = Math.min(20, Math.max(0, Math.floor(hintsUsed)));
      this.roundHintsUsed[playerId] = Math.max(
        this.roundHintsUsed[playerId] ?? 0,
        clampedHints
      );
    }
    const filled = this.config.categories.filter(
      (cat) => typeof cleanAnswers[cat] === 'string' && cleanAnswers[cat].trim().length > 0
    ).length;

    if (player.filledCount !== filled) {
      player.filledCount = filled;
      this.emitRoomState();
    }
  }

  private handlePressStop(
    playerId: string,
    answers?: Record<string, string>,
    hintsUsed?: number
  ): void {
    if (this.phase !== 'playing') return;
    const player = this.players.get(playerId);
    if (!player) return;

    if (answers) {
      this.roundAnswers[playerId] = sanitizeIncomingAnswers(
        answers,
        this.config.categories
      );
    }
    if (typeof hintsUsed === 'number' && Number.isFinite(hintsUsed)) {
      const clampedHints = Math.min(20, Math.max(0, Math.floor(hintsUsed)));
      this.roundHintsUsed[playerId] = Math.max(
        this.roundHintsUsed[playerId] ?? 0,
        clampedHints
      );
    }
    this.submittedPlayers.add(playerId);

    this.triggerRoundStop({
      reason: 'stop',
      stoppedByName: player.name,
      stoppedByPlayerId: player.id,
    });
  }

  private handleClientMessage(clientId: string, rawMessage: string): void {
    // Module 6 (API4) & 9.3 — Reject oversized LAN payloads to prevent logical DoS
    if (typeof rawMessage !== 'string' || rawMessage.length > MAX_LAN_MESSAGE_BYTES) {
      this.sendToGuest(clientId, {
        type: 'error',
        message: 'Mensaje demasiado grande.',
      });
      return;
    }

    let msg: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawMessage);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return;
      }
      msg = parsed as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join_room': {
        const requestedCode = canonicalizeRoomCode(msg.roomCode);
        if (!requestedCode || requestedCode !== this.roomCode) {
          // Module 9.3 — Opaque error: never disclose the active room code
          this.sendToGuest(clientId, {
            type: 'error',
            message: 'Código de sala incorrecto. Verifica el código con el anfitrión.',
          });
          return;
        }
        if (this.phase !== 'lobby') {
          this.sendToGuest(clientId, {
            type: 'error',
            message: 'Esta partida ya comenzó. Espera a que termine para unirte.',
          });
          return;
        }

        const existingId = this.clientToPlayerId.get(clientId);
        if (!existingId && this.players.size >= MAX_LAN_PLAYERS) {
          this.sendToGuest(clientId, {
            type: 'error',
            message: `La sala alcanzó el límite máximo de ${MAX_LAN_PLAYERS} jugadores.`,
          });
          return;
        }
        if (existingId) {
          this.players.delete(existingId);
        }

        const playerId = `ply_${Math.random().toString(36).slice(2, 9)}`;
        const playerName =
          sanitizeDisplayText(msg.playerName, MAX_PLAYER_NAME_LENGTH) ||
          `Jugador ${this.players.size + 1}`;
        const avatarId = sanitizeAvatarId(msg.avatarId);
        const avatarBg = sanitizeAvatarBg(msg.avatarBg);

        this.players.set(playerId, {
          id: playerId,
          clientId,
          name: playerName,
          avatarId,
          avatarBg,
          totalScore: 0,
          filledCount: 0,
        });
        this.clientToPlayerId.set(clientId, playerId);

        const snapshot = this.buildSnapshot();
        this.sendToGuest(clientId, {
          type: 'joined',
          playerId,
          room: snapshot,
        });
        this.emitRoomState();
        break;
      }

      case 'sync_draft': {
        const playerId = this.clientToPlayerId.get(clientId);
        if (!playerId || !msg.answers || typeof msg.answers !== 'object') return;
        this.handleDraft(
          playerId,
          msg.answers as Record<string, string>,
          typeof msg.hintsUsed === 'number' ? msg.hintsUsed : undefined
        );
        break;
      }

      case 'press_stop': {
        const playerId = this.clientToPlayerId.get(clientId);
        if (!playerId) return;
        this.handlePressStop(
          playerId,
          msg.answers && typeof msg.answers === 'object'
            ? (msg.answers as Record<string, string>)
            : undefined,
          typeof msg.hintsUsed === 'number' ? msg.hintsUsed : undefined
        );
        break;
      }

      case 'submit_answers': {
        const playerId = this.clientToPlayerId.get(clientId);
        if (!playerId) return;
        if (this.phase !== 'playing' && this.phase !== 'scoring') return;
        if (msg.answers && typeof msg.answers === 'object') {
          this.roundAnswers[playerId] = sanitizeIncomingAnswers(
            msg.answers,
            this.config.categories
          );
        }
        if (typeof msg.hintsUsed === 'number' && Number.isFinite(msg.hintsUsed)) {
          const clampedHints = Math.min(20, Math.max(0, Math.floor(msg.hintsUsed)));
          this.roundHintsUsed[playerId] = Math.max(
            this.roundHintsUsed[playerId] ?? 0,
            clampedHints
          );
        }
        this.submittedPlayers.add(playerId);
        if (
          this.phase === 'scoring' &&
          this.submittedPlayers.size >= this.players.size
        ) {
          void this.finalizeRound();
        }
        break;
      }

      case 'leave_room': {
        this.handleClientDisconnected(clientId);
        break;
      }

      default:
        break;
    }
  }

  private handleClientDisconnected(clientId: string): void {
    const playerId = this.clientToPlayerId.get(clientId);
    if (!playerId) return;
    this.clientToPlayerId.delete(clientId);
    this.players.delete(playerId);
    this.emitRoomState();

    if (
      this.phase === 'scoring' &&
      this.submittedPlayers.size >= this.players.size
    ) {
      this.finalizeRound();
    }
  }
}
