import { RoundResults } from '@stopmind/shared';

/**
 * Determines whether the current player finished in 1st place (including ties)
 * for the given round results and should see the full-screen confetti celebration.
 */
export function shouldCelebrateFirstPlace(
  roundResults: RoundResults | null | undefined,
  playerId: string | null | undefined
): boolean {
  if (!roundResults || roundResults.leaderboard.length === 0) {
    return false;
  }

  const myIndex = playerId
    ? roundResults.leaderboard.findIndex((entry) => entry.playerId === playerId)
    : 0;

  if (myIndex === -1) {
    return false;
  }

  const myEntry = roundResults.leaderboard[myIndex];
  const myRank = myEntry.rank ?? myIndex + 1;

  if (myRank !== 1) {
    return false;
  }

  // Avoid celebrating completely blank 0-point rounds
  if (roundResults.leaderboard.length === 1) {
    return roundResults.isFinalRound
      ? myEntry.totalScore > 0
      : myEntry.roundScore > 0;
  }

  return myEntry.totalScore > 0;
}

/**
 * Generates a stable trigger key for each round result so confetti replays
 * once per round (and on transition to final results) without re-triggering on re-renders.
 */
export function buildCelebrationTriggerKey(
  roundResults: RoundResults | null | undefined
): string {
  if (!roundResults) return '';
  return `${roundResults.roundNumber}-${roundResults.letter}-${roundResults.isFinalRound ? 'final' : 'round'}`;
}
