import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { sanitizeAvatarBg, sanitizeAvatarId } from './security';

const WEB_STORAGE_KEY = 'stopmind_player_name';
const WEB_AVATAR_STORAGE_KEY = 'stopmind_player_avatar';
const WEB_AVATAR_BG_STORAGE_KEY = 'stopmind_player_avatar_bg';
const PROFILE_FILENAME = 'stopmind-player-profile.json';
const DEFAULT_PLAYER_NAME = 'Jugador';
export const DEFAULT_AVATAR_ID = 'joven_m';
export const DEFAULT_AVATAR_BG_ID = 'indigo';

export interface LocalPlayerProfile {
  playerName: string;
  avatarId: string;
  avatarBg: string;
}

function getProfileFile(): File {
  return new File(Paths.document, PROFILE_FILENAME);
}

function readRawProfile(): {
  playerName?: string;
  avatarId?: string;
  avatarBg?: string;
} {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return {};
      const name = window.localStorage.getItem(WEB_STORAGE_KEY) ?? undefined;
      const avatar =
        window.localStorage.getItem(WEB_AVATAR_STORAGE_KEY) ?? undefined;
      const avatarBg =
        window.localStorage.getItem(WEB_AVATAR_BG_STORAGE_KEY) ?? undefined;
      return { playerName: name, avatarId: avatar, avatarBg };
    }

    const file = getProfileFile();
    if (!file.exists) {
      return {};
    }
    const raw = file.textSync();
    const parsed = JSON.parse(raw) as {
      playerName?: unknown;
      avatarId?: unknown;
      avatarBg?: unknown;
    };
    return {
      playerName:
        typeof parsed?.playerName === 'string' ? parsed.playerName : undefined,
      avatarId:
        typeof parsed?.avatarId === 'string' ? parsed.avatarId : undefined,
      avatarBg:
        typeof parsed?.avatarBg === 'string' ? parsed.avatarBg : undefined,
    };
  } catch {
    return {};
  }
}

function writeRawProfile(profile: {
  playerName?: string;
  avatarId?: string;
  avatarBg?: string;
}): void {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      if (profile.playerName) {
        window.localStorage.setItem(WEB_STORAGE_KEY, profile.playerName);
      } else {
        window.localStorage.removeItem(WEB_STORAGE_KEY);
      }
      if (profile.avatarId) {
        window.localStorage.setItem(WEB_AVATAR_STORAGE_KEY, profile.avatarId);
      } else {
        window.localStorage.removeItem(WEB_AVATAR_STORAGE_KEY);
      }
      if (profile.avatarBg) {
        window.localStorage.setItem(
          WEB_AVATAR_BG_STORAGE_KEY,
          profile.avatarBg
        );
      } else {
        window.localStorage.removeItem(WEB_AVATAR_BG_STORAGE_KEY);
      }
      return;
    }

    const file = getProfileFile();
    if (!profile.playerName && !profile.avatarId && !profile.avatarBg) {
      if (file.exists) {
        file.delete();
      }
      return;
    }
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    void file.write(JSON.stringify(profile)).catch(() => undefined);
  } catch {
    // Ignore storage write errors on restricted environments
  }
}

/**
 * Loads the locally stored player nickname from device storage (zero network/API calls).
 * Synchronous so the Home screen renders the saved name on the very first frame.
 */
export function loadSavedPlayerName(): string {
  const { playerName } = readRawProfile();
  const cleaned = playerName?.trim().slice(0, 22) ?? '';
  return cleaned || DEFAULT_PLAYER_NAME;
}

/**
 * Loads the locally stored avatar ID strictly from device storage (zero network/API calls).
 */
export function loadSavedAvatarId(): string {
  const { avatarId } = readRawProfile();
  return sanitizeAvatarId(avatarId) ?? DEFAULT_AVATAR_ID;
}

/**
 * Loads the locally stored avatar background palette ID strictly from device storage.
 */
export function loadSavedAvatarBg(): string {
  const { avatarBg } = readRawProfile();
  return sanitizeAvatarBg(avatarBg) ?? DEFAULT_AVATAR_BG_ID;
}

/**
 * Persists the player's nickname strictly on-device in the app sandbox.
 */
export function savePlayerNameLocal(rawName: string): void {
  const cleaned = rawName.trim().slice(0, 22);
  const current = readRawProfile();
  writeRawProfile({
    ...(cleaned ? { playerName: cleaned } : {}),
    ...(current.avatarId ? { avatarId: current.avatarId } : {}),
    ...(current.avatarBg ? { avatarBg: current.avatarBg } : {}),
  });
}

/**
 * Persists the player's selected avatar ID strictly on-device in the app sandbox.
 */
export function savePlayerAvatarLocal(rawAvatarId: string): void {
  const cleaned = sanitizeAvatarId(rawAvatarId) ?? DEFAULT_AVATAR_ID;
  const current = readRawProfile();
  writeRawProfile({
    ...(current.playerName ? { playerName: current.playerName } : {}),
    avatarId: cleaned,
    ...(current.avatarBg ? { avatarBg: current.avatarBg } : {}),
  });
}

/**
 * Persists the player's selected avatar background color ID strictly on-device.
 */
export function savePlayerAvatarBgLocal(rawBgId: string): void {
  const cleaned = sanitizeAvatarBg(rawBgId) ?? DEFAULT_AVATAR_BG_ID;
  const current = readRawProfile();
  writeRawProfile({
    ...(current.playerName ? { playerName: current.playerName } : {}),
    ...(current.avatarId ? { avatarId: current.avatarId } : {}),
    avatarBg: cleaned,
  });
}
