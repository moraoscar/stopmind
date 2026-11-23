import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as StoreReview from 'expo-store-review';

const REVIEW_STATE_FILENAME = 'stopmind-review-state.json';
const MIN_MATCHES_BEFORE_PROMPT = 2;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 días entre solicitudes
const MAX_LOCAL_PROMPTS = 3;

interface ReviewState {
  completedMatches: number;
  lastPromptedAt: number | null;
  promptCount: number;
}

const DEFAULT_STATE: ReviewState = {
  completedMatches: 0,
  lastPromptedAt: null,
  promptCount: 0,
};

function getStateFile(): File {
  return new File(Paths.document, REVIEW_STATE_FILENAME);
}

function readReviewState(): ReviewState {
  try {
    if (Platform.OS === 'web') return DEFAULT_STATE;
    const file = getStateFile();
    if (!file.exists) return DEFAULT_STATE;
    const parsed = JSON.parse(file.textSync()) as Partial<ReviewState>;
    return {
      completedMatches:
        typeof parsed.completedMatches === 'number' &&
        Number.isFinite(parsed.completedMatches)
          ? Math.max(0, Math.floor(parsed.completedMatches))
          : 0,
      lastPromptedAt:
        typeof parsed.lastPromptedAt === 'number' &&
        Number.isFinite(parsed.lastPromptedAt)
          ? parsed.lastPromptedAt
          : null,
      promptCount:
        typeof parsed.promptCount === 'number' &&
        Number.isFinite(parsed.promptCount)
          ? Math.max(0, Math.floor(parsed.promptCount))
          : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeReviewState(state: ReviewState): void {
  try {
    if (Platform.OS === 'web') return;
    const file = getStateFile();
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    void file.write(JSON.stringify(state)).catch(() => undefined);
  } catch {
    // Ignore restricted filesystem errors
  }
}

/**
 * Records a completed match locally and, when appropriate, displays the
 * official native iOS / Android store review sheet (no review gating).
 */
export async function recordCompletedMatchAndMaybeRequestReview(): Promise<void> {
  if (Platform.OS === 'web') return;

  const state = readReviewState();
  const nextCompleted = state.completedMatches + 1;
  const now = Date.now();

  const updatedState: ReviewState = {
    ...state,
    completedMatches: nextCompleted,
  };
  writeReviewState(updatedState);

  if (nextCompleted < MIN_MATCHES_BEFORE_PROMPT) return;
  if (state.promptCount >= MAX_LOCAL_PROMPTS) return;
  if (state.lastPromptedAt && now - state.lastPromptedAt < COOLDOWN_MS) return;

  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    writeReviewState({
      completedMatches: nextCompleted,
      lastPromptedAt: now,
      promptCount: state.promptCount + 1,
    });

    await StoreReview.requestReview();
  } catch {
    // Native review prompt is best-effort and OS-throttled
  }
}

/**
 * Opens the native in-app store review prompt directly when tapped by the user.
 */
export async function promptStoreReviewManually(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const canReview = await StoreReview.hasAction();
    if (canReview) {
      await StoreReview.requestReview();
    }
  } catch {
    // Ignore on unsupported environments (e.g., simulator/TestFlight)
  }
}
