import assert from 'node:assert/strict';
import test from 'node:test';
import { OnlineRoomEngine, RoomTransport } from '../roomEngine';

function createMockTransport() {
  const sentByClient = new Map<string, Record<string, unknown>[]>();
  const broadcasts: Record<string, unknown>[] = [];
  const timers = new Map<string, () => void>();

  const transport: RoomTransport = {
    sendTo(clientId, payload) {
      const arr = sentByClient.get(clientId) ?? [];
      arr.push(payload);
      sentByClient.set(clientId, arr);
    },
    broadcast(payload) {
      broadcasts.push(payload);
    },
    scheduleTimer(key, _delayMs, fn) {
      timers.set(key, fn);
    },
    clearTimer(key) {
      timers.delete(key);
    },
  };

  return { transport, sentByClient, broadcasts, timers };
}

test('creates room, lets guest join, starts round, and scores on STOP', async () => {
  const { transport, sentByClient, broadcasts } = createMockTransport();
  const engine = new OnlineRoomEngine('K7M2', transport);

  engine.handleMessage(
    'host_1',
    JSON.stringify({
      type: 'create_room',
      playerName: 'Oscar',
      config: {
        categories: ['Nombre', 'Animal'],
        allowedLetters: ['M'],
        timeLimitSeconds: 60,
        totalRounds: 2,
        validateLetter: true,
        aiValidation: false,
      },
    })
  );

  const hostJoined = sentByClient.get('host_1')?.[0];
  assert.equal(hostJoined?.type, 'joined');
  assert.equal(engine.playerCount, 1);

  engine.handleMessage(
    'guest_1',
    JSON.stringify({
      type: 'join_room',
      roomCode: 'K7M2',
      playerName: 'Sofía',
    })
  );

  const guestJoined = sentByClient.get('guest_1')?.[0];
  assert.equal(guestJoined?.type, 'joined');
  assert.equal(engine.playerCount, 2);

  engine.handleMessage('host_1', JSON.stringify({ type: 'start_game' }));
  const roundStarted = broadcasts.find((b) => b.type === 'round_started');
  assert.equal(roundStarted?.letter, 'M');

  engine.handleMessage(
    'host_1',
    JSON.stringify({
      type: 'press_stop',
      answers: { Nombre: 'María', Animal: 'Mono' },
      hintsUsed: 0,
    })
  );

  engine.handleMessage(
    'guest_1',
    JSON.stringify({
      type: 'submit_answers',
      answers: { Nombre: 'Maria', Animal: 'Murciélago' },
      hintsUsed: 0,
    })
  );

  await new Promise((r) => setTimeout(r, 15));

  const resultsMsg = broadcasts.find((b) => b.type === 'round_results');
  assert.ok(resultsMsg, 'Expected round_results broadcast');
  const results = resultsMsg.results as {
    roundScores: Record<string, number>;
  };
  // María vs Maria = duplicate (50 pts each), Mono vs Murciélago = unique (100 pts each) -> 150 each
  assert.equal(results.roundScores.host_1, 150);
  assert.equal(results.roundScores.guest_1, 150);
});

test('rejects joining non-existent room and transfers host on disconnect', () => {
  const { transport, sentByClient } = createMockTransport();
  const engine = new OnlineRoomEngine('ABCD', transport);

  engine.handleMessage(
    'guest_1',
    JSON.stringify({ type: 'join_room', roomCode: 'ABCD', playerName: 'Ana' })
  );
  assert.equal(sentByClient.get('guest_1')?.[0]?.type, 'error');

  engine.handleMessage(
    'host_1',
    JSON.stringify({ type: 'create_room', playerName: 'Oscar' })
  );
  engine.handleMessage(
    'guest_1',
    JSON.stringify({ type: 'join_room', roomCode: 'ABCD', playerName: 'Ana' })
  );
  engine.handleDisconnect('host_1');
  assert.equal(engine.playerCount, 1);
});

test('host can finish match early after round 1 of 3 and guest finish_game is ignored', async () => {
  const { transport, broadcasts } = createMockTransport();
  const engine = new OnlineRoomEngine('END1', transport);

  engine.handleMessage(
    'host_1',
    JSON.stringify({
      type: 'create_room',
      playerName: 'Oscar',
      config: {
        categories: ['Nombre', 'Animal'],
        allowedLetters: ['M', 'P', 'S'],
        timeLimitSeconds: 60,
        totalRounds: 3,
        validateLetter: true,
        aiValidation: false,
      },
    })
  );

  engine.handleMessage(
    'guest_1',
    JSON.stringify({
      type: 'join_room',
      roomCode: 'END1',
      playerName: 'Sofía',
    })
  );

  engine.handleMessage('host_1', JSON.stringify({ type: 'start_game' }));
  const firstLetter = (
    broadcasts.find((b) => b.type === 'round_started') as { letter: string }
  ).letter;

  engine.handleMessage(
    'host_1',
    JSON.stringify({
      type: 'press_stop',
      answers: { Nombre: `${firstLetter}ateo`, Animal: `${firstLetter}ono` },
      hintsUsed: 0,
    })
  );
  engine.handleMessage(
    'guest_1',
    JSON.stringify({
      type: 'submit_answers',
      answers: { Nombre: `${firstLetter}aría`, Animal: '' },
      hintsUsed: 0,
    })
  );

  await new Promise((r) => setTimeout(r, 15));

  const round1Results = broadcasts
    .filter((b) => b.type === 'round_results')
    .at(-1)?.results as { isFinalRound: boolean; roundNumber: number };
  assert.equal(round1Results.roundNumber, 1);
  assert.equal(round1Results.isFinalRound, false);

  // Guest cannot finish the match for everyone
  const countBeforeGuest = broadcasts.length;
  engine.handleMessage('guest_1', JSON.stringify({ type: 'finish_game' }));
  assert.equal(broadcasts.length, countBeforeGuest);

  // Host finishes match early -> room transitions to finished with isFinalRound: true & preserved scores
  engine.handleMessage('host_1', JSON.stringify({ type: 'finish_game' }));

  const finalRoomState = broadcasts
    .filter((b) => b.type === 'room_state')
    .at(-1)?.room as { phase: string };
  assert.equal(finalRoomState.phase, 'finished');

  const finalResults = broadcasts
    .filter((b) => b.type === 'round_results')
    .at(-1)?.results as {
    isFinalRound: boolean;
    roundNumber: number;
    totalRounds: number;
    leaderboard: { playerId: string; totalScore: number; rank: number }[];
  };
  assert.equal(finalResults.isFinalRound, true);
  assert.equal(finalResults.roundNumber, 1);
  assert.equal(finalResults.totalRounds, 3);
  assert.equal(finalResults.leaderboard[0]?.playerId, 'host_1');
  assert.equal(finalResults.leaderboard[0]?.totalScore, 200);
  assert.equal(finalResults.leaderboard[1]?.playerId, 'guest_1');
  assert.equal(finalResults.leaderboard[1]?.totalScore, 100);
});
