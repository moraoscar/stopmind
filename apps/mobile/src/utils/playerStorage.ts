import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

const WEB_STORAGE_KEY = 'stopmind_player_name';
const PROFILE_FILENAME = 'stopmind-player-profile.json';
const DEFAULT_PLAYER_NAME = 'Jugador';

function getProfileFile(): File {
  return new File(Paths.document, PROFILE_FILENAME);
}

/**
 * Loads the locally stored player nickname from device storage (zero network/API calls).
 * Synchronous so the Home screen renders the saved name on the very first frame.
 */
export function loadSavedPlayerName(): string {
  try {
    if (Platform.OS === 'web') {
      const saved =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(WEB_STORAGE_KEY)
          : null;
      const cleaned = saved?.trim().slice(0, 22) ?? '';
      return cleaned || DEFAULT_PLAYER_NAME;
    }

    const file = getProfileFile();
    if (!file.exists) {
      return DEFAULT_PLAYER_NAME;
    }
    const raw = file.textSync();
    const parsed = JSON.parse(raw) as { playerName?: unknown };
    if (typeof parsed?.playerName === 'string') {
      const cleaned = parsed.playerName.trim().slice(0, 22);
      if (cleaned) return cleaned;
    }
  } catch {
    // Ignore storage read errors and fall back to default nickname
  }
  return DEFAULT_PLAYER_NAME;
}

/**
 * Persists the player's nickname strictly on-device in the app sandbox.
 */
export function savePlayerNameLocal(rawName: string): void {
  const cleaned = rawName.trim().slice(0, 22);
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      if (cleaned) {
        window.localStorage.setItem(WEB_STORAGE_KEY, cleaned);
      } else {
        window.localStorage.removeItem(WEB_STORAGE_KEY);
      }
      return;
    }

    const file = getProfileFile();
    if (!cleaned) {
      if (file.exists) {
        file.delete();
      }
      return;
    }
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    void file.write(JSON.stringify({ playerName: cleaned })).catch(() => undefined);
  } catch {
    // Ignore storage write errors on restricted environments
  }
}
