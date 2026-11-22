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
