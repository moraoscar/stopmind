import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areWordsSimilar,
  buildRankedLeaderboard,
  scoreRoundLocal,
} from '@stopmind/shared';

test('Distinct Spanish surnames, names, and words are NEVER marked as duplicates', () => {
  const distinctPairs: [string, string][] = [
    ['Frías', 'Farías'],
    ['Frias', 'Farias'],
    ['María', 'Mario'],
    ['Camila', 'Camilo'],
    ['Daniel', 'Daniela'],
    ['Sofía', 'Sonia'],
    ['Rojas', 'Rosas'],
    ['Pérez', 'Páez'],
    ['Panamá', 'Paraná'],
    ['Austria', 'Australia'],
    ['Perro', 'Pero'],
    ['Carro', 'Caro'],
    ['Pato', 'Gato'],
    ['Cabra', 'Cobra'],
    ['Castro', 'Castor'],
  ];

  for (const [a, b] of distinctPairs) {
    assert.equal(
      areWordsSimilar(a, b),
      false,
      `Expected "${a}" and "${b}" to be distinct`
    );
  }
});

test('True duplicates, accents, phonetic twins, and long-word transpositions ARE marked as duplicates', () => {
  const duplicatePairs: [string, string][] = [
    ['Frías', 'Frias'],
    ['Farías', 'farias'],
    ['México', 'Mexico'],
    ['Gómez', 'Gomes'],
    ['Sánchez', 'Sanches'],
    ['Jirafa', 'Girafa'],
    ['Ballena', 'Bayena'],
    ['Zanahoria', 'Sanaoria'],
    ['Vaca', 'Baca'],
    ['Helado', 'Elado'],
    ['Manzana', 'Manazna'],
    ['Colombia', 'Colomiba'],
  ];

  for (const [a, b] of duplicatePairs) {
    assert.equal(
      areWordsSimilar(a, b),
      true,
      `Expected "${a}" and "${b}" to be treated as duplicates`
    );
  }
});

test('scoreRoundLocal awards 100 pts each for Frias and Farias under Apellido (F)', () => {
  const { categoryResults, roundScores } = scoreRoundLocal({
    categories: ['Apellido'],
    letter: 'F',
    validateLetter: true,
    players: [
      { id: 'p1', name: 'Oscar' },
      { id: 'p2', name: 'Ana' },
    ],
    answersByPlayer: {
      p1: { Apellido: 'Frias' },
      p2: { Apellido: 'Farias' },
    },
  });

  assert.equal(roundScores.p1, 100);
  assert.equal(roundScores.p2, 100);
  assert.equal(categoryResults[0]?.entries[0]?.reason, 'unique');
  assert.equal(categoryResults[0]?.entries[1]?.reason, 'unique');
});

test('buildRankedLeaderboard — 2-player tie: whoever pressed STOP wins #1 even if NOT host', () => {
  const board = buildRankedLeaderboard({
    entries: [
      { playerId: 'host', playerName: 'Anfitrión', roundScore: 300, totalScore: 300, isHost: true },
      { playerId: 'guest', playerName: 'Invitado', roundScore: 300, totalScore: 300, isHost: false },
    ],
    stopReason: 'stop',
    stoppedByPlayerId: 'guest',
  });

  assert.equal(board[0]?.playerId, 'guest');
  assert.equal(board[0]?.rank, 1);
  assert.equal(board[0]?.wonTiebreak, true);
  assert.equal(board[1]?.playerId, 'host');
  assert.equal(board[1]?.rank, 2);
  assert.equal(board[1]?.wonTiebreak, false);
});

test('buildRankedLeaderboard — 2-player tie on timeout: both tie at #1 (no #2)', () => {
  const board = buildRankedLeaderboard({
    entries: [
      { playerId: 'p1', playerName: 'Oscar', roundScore: 300, totalScore: 300, isHost: true },
      { playerId: 'p2', playerName: 'Ana', roundScore: 300, totalScore: 300, isHost: false },
    ],
    stopReason: 'timeout',
    stoppedByPlayerId: null,
  });

  assert.equal(board[0]?.rank, 1);
  assert.equal(board[1]?.rank, 1);
  assert.equal(board[0]?.wonTiebreak, false);
  assert.equal(board[1]?.wonTiebreak, false);
});

test('buildRankedLeaderboard — 3 players: P1 & P2 tied at #1, P3 (who pressed STOP with fewer pts) gets #3', () => {
  const board = buildRankedLeaderboard({
    entries: [
      { playerId: 'p1', playerName: 'Jugador 1', roundScore: 300, totalScore: 300, isHost: true },
      { playerId: 'p2', playerName: 'Jugador 2', roundScore: 300, totalScore: 300, isHost: false },
      { playerId: 'p3', playerName: 'Jugador 3', roundScore: 200, totalScore: 200, isHost: false },
    ],
    stopReason: 'stop',
    stoppedByPlayerId: 'p3',
  });

  const byId = Object.fromEntries(board.map((b) => [b.playerId, b]));
  assert.equal(byId.p1.rank, 1);
  assert.equal(byId.p2.rank, 1);
  assert.equal(byId.p3.rank, 3);
  assert.equal(byId.p3.wonTiebreak, false);
});

test('buildRankedLeaderboard — 4 players: P1 & P2 tied #1, P3 & P4 tied at 200 pts where P4 pressed STOP -> P4=#3, P3=#4', () => {
  const board = buildRankedLeaderboard({
    entries: [
      { playerId: 'p1', playerName: 'Jugador 1', roundScore: 400, totalScore: 400, isHost: true },
      { playerId: 'p2', playerName: 'Jugador 2', roundScore: 400, totalScore: 400, isHost: false },
      { playerId: 'p3', playerName: 'Jugador 3', roundScore: 200, totalScore: 200, isHost: false },
      { playerId: 'p4', playerName: 'Jugador 4', roundScore: 200, totalScore: 200, isHost: false },
    ],
    stopReason: 'stop',
    stoppedByPlayerId: 'p4',
  });

  const byId = Object.fromEntries(board.map((b) => [b.playerId, b]));
  assert.equal(byId.p1.rank, 1);
  assert.equal(byId.p2.rank, 1);
  assert.equal(byId.p4.rank, 3);
  assert.equal(byId.p4.wonTiebreak, true);
  assert.equal(byId.p3.rank, 4);
  assert.equal(byId.p3.wonTiebreak, false);
});

test('buildRankedLeaderboard — 3 players all tied at 300 pts where P3 pressed STOP -> P3=#1, P1=#2, P2=#2', () => {
  const board = buildRankedLeaderboard({
    entries: [
      { playerId: 'p1', playerName: 'Jugador 1', roundScore: 300, totalScore: 300, isHost: true },
      { playerId: 'p2', playerName: 'Jugador 2', roundScore: 300, totalScore: 300, isHost: false },
      { playerId: 'p3', playerName: 'Jugador 3', roundScore: 300, totalScore: 300, isHost: false },
    ],
    stopReason: 'stop',
    stoppedByPlayerId: 'p3',
  });

  const byId = Object.fromEntries(board.map((b) => [b.playerId, b]));
  assert.equal(byId.p3.rank, 1);
  assert.equal(byId.p3.wonTiebreak, true);
  assert.equal(byId.p1.rank, 2);
  assert.equal(byId.p2.rank, 2);
});
