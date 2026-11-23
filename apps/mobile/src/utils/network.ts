import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEFAULT_SERVER_PORT } from '../constants/game';
import {
  canonicalizeRoomCode,
  isAllowedInviteLinkUrl,
  isAllowedRealtimeWsUrl,
} from './security';

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

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomRoomCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function getOnlineRealtimeBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_ONLINE_WS_URL;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('https://')) {
    return trimmed.replace(/^https:\/\//, 'wss://');
  }
  if (trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//, 'ws://');
  }
  if (trimmed.startsWith('wss://') || trimmed.startsWith('ws://')) {
    return trimmed;
  }
  return `wss://${trimmed}`;
}

export function buildOnlineRoomWsUrl(roomCode: string, baseOverride?: string): string {
  const base = (baseOverride ?? getOnlineRealtimeBaseUrl()).replace(/\/+$/, '');
  const code = roomCode.trim().toUpperCase();
  if (!base || !code) return '';
  return `${base}/room/${encodeURIComponent(code)}`;
}

export function isOnlineWsUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('wss://') || trimmed.includes('/room/');
}

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return getDefaultLanServerUrl();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  if (trimmed.startsWith('https://')) {
    return trimmed.replace(/^https:\/\//, 'wss://');
  }
  if (trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//, 'ws://');
  }
  if (trimmed.includes(':')) {
    return `ws://${trimmed}`;
  }
  return `ws://${trimmed}:${DEFAULT_SERVER_PORT}`;
}

const PUBLIC_JOIN_BASE_URL = 'https://stopmind.cxvone.com/join';

export function buildJoinQrPayload(wsUrl: string, roomCode: string): string {
  const encodedWs = encodeURIComponent(wsUrl);
  const encodedRoom = encodeURIComponent(roomCode.toUpperCase());
  return `stopmind://join?ws=${encodedWs}&room=${encodedRoom}`;
}

/**
 * Builds a clickable HTTPS Universal Link / App Link ideal for WhatsApp, iMessage, and SMS.
 * - Online rooms produce a clean short link: https://stopmind.cxvone.com/join?room=ABCD
 * - Local WiFi rooms include the host LAN ws:// address so guests on the same WiFi auto-connect.
 */
export function buildShareableJoinLink(
  wsUrl: string,
  roomCode: string,
  isOnline: boolean
): string {
  const cleanRoom = roomCode.trim().toUpperCase();
  if (!cleanRoom) return PUBLIC_JOIN_BASE_URL;
  if (isOnline) {
    return `${PUBLIC_JOIN_BASE_URL}?room=${encodeURIComponent(cleanRoom)}`;
  }
  const encodedWs = encodeURIComponent(wsUrl);
  return `${PUBLIC_JOIN_BASE_URL}?room=${encodeURIComponent(cleanRoom)}&ws=${encodedWs}`;
}

export interface ParsedJoinQr {
  wsUrl: string;
  roomCode: string;
  isOnline: boolean;
}

export function parseJoinQrPayload(raw: string): ParsedJoinQr | null {
  const text = raw.trim();
  if (!text || text.length > 1024) return null;

  const configuredOnlineBase = getOnlineRealtimeBaseUrl();

  // Format 1: stopmind://join?room=...&ws=... OR https://stopmind.cxvone.com/join?room=...(&ws=...)
  try {
    if (text.includes('://')) {
      if (!isAllowedInviteLinkUrl(text)) {
        return null;
      }
      const queryStart = text.indexOf('?');
      if (queryStart !== -1) {
        const params = new URLSearchParams(text.slice(queryStart + 1));
        const ws = params.get('ws')?.trim() ?? '';
        const room = canonicalizeRoomCode(params.get('room'));
        if (room) {
          if (ws) {
            const normalized = normalizeServerUrl(ws);
            if (!isAllowedRealtimeWsUrl(normalized, configuredOnlineBase)) {
              return null;
            }
            return {
              wsUrl: normalized,
              roomCode: room,
              isOnline: isOnlineWsUrl(normalized),
            };
          }
          // Universal Link without `ws` parameter -> Online room on official realtime host
          const onlineWs = buildOnlineRoomWsUrl(room);
          if (onlineWs && isAllowedRealtimeWsUrl(onlineWs, configuredOnlineBase)) {
            return {
              wsUrl: onlineWs,
              roomCode: room,
              isOnline: true,
            };
          }
        }
      }
    }
  } catch {
    // Fall through to JSON format
  }

  // Format 2: JSON { ws, room }
  try {
    const parsed = JSON.parse(text) as { ws?: unknown; room?: unknown };
    const room = canonicalizeRoomCode(parsed?.room);
    if (typeof parsed?.ws === 'string' && room) {
      const normalized = normalizeServerUrl(parsed.ws);
      if (!isAllowedRealtimeWsUrl(normalized, configuredOnlineBase)) {
        return null;
      }
      return {
        wsUrl: normalized,
        roomCode: room,
        isOnline: isOnlineWsUrl(normalized),
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
