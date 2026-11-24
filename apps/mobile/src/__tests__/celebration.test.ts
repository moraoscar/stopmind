import assert from 'node:assert/strict';
import test from 'node:test';
import { RoundResults } from '@stopmind/shared';
import {
  buildCelebrationTriggerKey,
  shouldCelebrateFirstPlace,
} from '../utils/celebration';

function makeResults(overrides?: Partial<RoundResults>): RoundResults {
  return {
    roundNumber: 1,
    totalRounds: 3,
    letter: 'M',
    stopReason: 'stop',
    stoppedByName: 'Oscar',
    stoppedByPlayerId: 'p1',
    categoryResults: [],
    roundScores: { p1: 200, p2: 150 },
    leaderboard: [
      {
        playerId: 'p1',
        playerName: 'Oscar',
        roundScore: 200,
        totalScore: 200,
        isHost: true,
        rank: 1,
        stoppedRound: true,
        wonTiebreak: false,
      },
      {
        playerId: 'p2',
        playerName: 'Sofía',
        roundScore: 150,
        totalScore: 150,
        isHost: false,
        rank: 2,
        stoppedRound: false,
        wonTiebreak: false,
      },
    ],
    isFinalRound: false,
    validatedBy: 'local',
    ...overrides,
  };
}

test('celebrates only the 1st-place player in multiplayer rounds', () => {
  const results = makeResults();
  assert.equal(shouldCelebrateFirstPlace(results, 'p1'), true);
  assert.equal(shouldCelebrateFirstPlace(results, 'p2'), false);
  assert.equal(shouldCelebrateFirstPlace(results, 'unknown'), false);
});

test('celebrates all participants tied in 1st place (rank === 1)', () => {
  const tiedResults = makeResults({
    stopReason: 'timeout',
    stoppedByName: null,
    stoppedByPlayerId: null,
    leaderboard: [
      {
        playerId: 'p1',
        playerName: 'Oscar',
        roundScore: 200,
        totalScore: 200,
        isHost: true,
        rank: 1,
        stoppedRound: false,
        wonTiebreak: false,
      },
      {
        playerId: 'p2',
        playerName: 'Sofía',
        roundScore: 200,
        totalScore: 200,
        isHost: false,
        rank: 1,
        stoppedRound: false,
        wonTiebreak: false,
      },
      {
        playerId: 'p3',
        playerName: 'Leo',
        roundScore: 100,
        totalScore: 100,
        isHost: false,
        rank: 3,
        stoppedRound: false,
        wonTiebreak: false,
      },
    ],
  });

  assert.equal(shouldCelebrateFirstPlace(tiedResults, 'p1'), true);
  assert.equal(shouldCelebrateFirstPlace(tiedResults, 'p2'), true);
  assert.equal(shouldCelebrateFirstPlace(tiedResults, 'p3'), false);
});

test('does not celebrate when everyone has 0 points', () => {
  const zeroResults = makeResults({
    leaderboard: [
      {
        playerId: 'p1',
        playerName: 'Oscar',
        roundScore: 0,
        totalScore: 0,
        isHost: true,
        rank: 1,
      },
      {
        playerId: 'p2',
        playerName: 'Sofía',
        roundScore: 0,
        totalScore: 0,
        isHost: false,
        rank: 1,
      },
    ],
  });

  assert.equal(shouldCelebrateFirstPlace(zeroResults, 'p1'), false);
  assert.equal(shouldCelebrateFirstPlace(zeroResults, 'p2'), false);
});

test('handles solo mode rounds with positive vs zero score', () => {
  const soloWin = makeResults({
    leaderboard: [
      {
        playerId: 'local_player',
        playerName: 'Oscar',
        roundScore: 100,
        totalScore: 100,
        isHost: true,
        rank: 1,
      },
    ],
  });
  const soloBlankRound = makeResults({
    roundNumber: 2,
    isFinalRound: false,
    leaderboard: [
      {
        playerId: 'local_player',
        playerName: 'Oscar',
        roundScore: 0,
        totalScore: 100,
        isHost: true,
        rank: 1,
      },
    ],
  });
  const soloFinalWithTotal = makeResults({
    roundNumber: 3,
    isFinalRound: true,
    leaderboard: [
      {
        playerId: 'local_player',
        playerName: 'Oscar',
        roundScore: 0,
        totalScore: 100,
        isHost: true,
        rank: 1,
      },
    ],
  });

  assert.equal(shouldCelebrateFirstPlace(soloWin, 'local_player'), true);
  assert.equal(shouldCelebrateFirstPlace(soloBlankRound, 'local_player'), false);
  assert.equal(
    shouldCelebrateFirstPlace(soloFinalWithTotal, 'local_player'),
    true
  );
});

test('builds distinct celebration trigger keys per round and final state', () => {
  const r1 = makeResults({ roundNumber: 1, letter: 'M', isFinalRound: false });
  const r2 = makeResults({ roundNumber: 2, letter: 'S', isFinalRound: false });
  const r2Final = makeResults({
    roundNumber: 2,
    letter: 'S',
    isFinalRound: true,
  });

  assert.equal(buildCelebrationTriggerKey(r1), '1-M-round');
  assert.equal(buildCelebrationTriggerKey(r2), '2-S-round');
  assert.equal(buildCelebrationTriggerKey(r2Final), '2-S-final');
  assert.equal(buildCelebrationTriggerKey(null), '');
});
