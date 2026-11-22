import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEFAULT_SERVER_PORT } from '../constants/game';

/**
 * Automatically discovers the host machine's local WiFi IP from Expo Go / Metro
 * so devices on the same WiFi network can connect without manual IP entry.
 */
export function getDefaultLanServerUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    return `ws://${hostname}:${DEFAULT_SERVER_PORT}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as unknown as { debuggerHost?: string }).debuggerHost ??
    '';

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:${DEFAULT_SERVER_PORT}`;
    }
  }

  return `ws://192.168.1.100:${DEFAULT_SERVER_PORT}`;
}

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return getDefaultLanServerUrl();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//, 'ws://');
  }
  if (trimmed.includes(':')) {
    return `ws://${trimmed}`;
  }
  return `ws://${trimmed}:${DEFAULT_SERVER_PORT}`;
}

export function buildJoinQrPayload(wsUrl: string, roomCode: string): string {
  const encodedWs = encodeURIComponent(wsUrl);
  const encodedRoom = encodeURIComponent(roomCode.toUpperCase());
  return `stopmind://join?ws=${encodedWs}&room=${encodedRoom}`;
}

export interface ParsedJoinQr {
  wsUrl: string;
  roomCode: string;
}

export function parseJoinQrPayload(raw: string): ParsedJoinQr | null {
  const text = raw.trim();
  if (!text) return null;

  // Format 1: stopgame://join?ws=...&room=...
  try {
    if (text.includes('://')) {
      const queryStart = text.indexOf('?');
      if (queryStart !== -1) {
        const params = new URLSearchParams(text.slice(queryStart + 1));
        const ws = params.get('ws');
        const room = params.get('room');
        if (ws && room) {
          return {
            wsUrl: normalizeServerUrl(ws),
            roomCode: room.trim().toUpperCase(),
          };
        }
      }
    }
  } catch {
    // Fall through to JSON format
  }

  // Format 2: JSON { ws, room }
  try {
    const parsed = JSON.parse(text) as { ws?: string; room?: string };
    if (parsed.ws && parsed.room) {
      return {
        wsUrl: normalizeServerUrl(parsed.ws),
        roomCode: parsed.room.trim().toUpperCase(),
      };
    }
  } catch {
    // Invalid QR payload
  }

  return null;
}

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
