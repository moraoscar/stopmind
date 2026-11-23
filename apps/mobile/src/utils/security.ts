import type { RoomSnapshot, RoundResults } from '@stopmind/shared';

/**
 * Security & Resilience controls for STOPMind! Mobile
 * Aligned with OWASP MASVS 2.1.0, OWASP API/LLM Top 10, and Fail-Secure architecture.
 */

export const MAX_WS_INCOMING_BYTES = 64 * 1024;
export const MAX_LAN_MESSAGE_BYTES = 16 * 1024;
export const MAX_LAN_PLAYERS = 12;
export const MAX_ANSWER_LENGTH = 48;
export const MAX_PLAYER_NAME_LENGTH = 22;
export const MAX_REASON_LENGTH = 120;
export const MAX_HINT_LENGTH = 40;
export const MAX_LOCAL_CACHE_ENTRIES = 500;

const ROOM_CODE_REGEX = /^[A-Z0-9]{4,8}$/;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

const DEFAULT_ALLOWED_REALTIME_HOSTS = new Set<string>([
  'stopmind-realtime.stopmind.workers.dev',
]);

const ALLOWED_INVITE_WEB_HOSTS = new Set<string>([
  'stopmind.cxvone.com',
  'www.stopmind.cxvone.com',
]);

const FORBIDDEN_OBJECT_KEYS = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Module 9.3 — Bounded FIFO Map so in-memory caches never grow infinitely (anti logical DoS).
 */
export class BoundedMap<K, V> {
  private readonly store = new Map<K, V>();
  private readonly maxEntries: number;

  constructor(maxEntries = MAX_LOCAL_CACHE_ENTRIES) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  get size(): number {
    return this.store.size;
  }

  get(key: K): V | undefined {
    return this.store.get(key);
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Module 1.2 & 8 (LLM05) — Strip control characters and enforce strict display length.
 */
export function sanitizeDisplayText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(CONTROL_CHARS_REGEX, '')
    .trim()
    .slice(0, Math.max(0, maxLen));
}

/**
 * Module 1.2 — Canonicalize and validate room codes against a strict whitelist.
 */
export function canonicalizeRoomCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.replace(CONTROL_CHARS_REGEX, '').trim().toUpperCase();
  return ROOM_CODE_REGEX.test(cleaned) ? cleaned : '';
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

/**
 * Module 3.2 — Strict private LAN host check (RFC1918 + localhost / mDNS .local).
 * Explicitly excludes link-local cloud metadata ranges (169.254.0.0/16).
 */
export function isPrivateLanHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true;
  }
  if (/^[a-z0-9-]{1,63}\.local$/.test(host)) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4Match) return false;

  const octets = ipv4Match.slice(1).map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

interface ParsedUrlParts {
  protocol: string;
  hasCredentials: boolean;
  hostname: string;
  port: string;
  pathname: string;
}

/**
 * Runtime-independent strict URL parser (Hermes/React Native's built-in URL polyfill
 * only parses http:// and https://, returning empty hostname for ws://, wss://, stopmind://).
 */
export function parseStrictUrl(raw: string): ParsedUrlParts | null {
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u0020\u007F]/.test(trimmed)) return null;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/.exec(trimmed);
  if (!schemeMatch) return null;

  const protocol = `${schemeMatch[1].toLowerCase()}:`;
  const rest = schemeMatch[2];

  const delimIdx = rest.search(/[/?#]/);
  const authority = delimIdx === -1 ? rest : rest.slice(0, delimIdx);
  const afterAuthority = delimIdx === -1 ? '' : rest.slice(delimIdx);

  const queryOrHashIdx = afterAuthority.search(/[?#]/);
  const pathname =
    queryOrHashIdx === -1
      ? afterAuthority
      : afterAuthority.slice(0, queryOrHashIdx);

  if (!authority) {
    // Allow custom scheme with empty authority like stopmind:///join
    if (protocol === 'stopmind:' && pathname) {
      return {
        protocol,
        hasCredentials: false,
        hostname: '',
        port: '',
        pathname,
      };
    }
    return null;
  }

  if (authority.includes('@')) {
    return {
      protocol,
      hasCredentials: true,
      hostname: '',
      port: '',
      pathname,
    };
  }

  let hostname = '';
  let port = '';

  if (authority.startsWith('[')) {
    const closeIdx = authority.indexOf(']');
    if (closeIdx === -1) return null;
    hostname = authority.slice(1, closeIdx).toLowerCase();
    const afterBracket = authority.slice(closeIdx + 1);
    if (afterBracket) {
      if (!/^:\d+$/.test(afterBracket)) return null;
      port = afterBracket.slice(1);
    }
  } else {
    const colonIdx = authority.indexOf(':');
    if (colonIdx !== -1) {
      if (authority.indexOf(':', colonIdx + 1) !== -1) return null;
      hostname = authority.slice(0, colonIdx).toLowerCase();
      port = authority.slice(colonIdx + 1);
      if (!/^\d+$/.test(port)) return null;
    } else {
      hostname = authority.toLowerCase();
    }
  }

  if (!hostname) return null;

  return {
    protocol,
    hasCredentials: false,
    hostname,
    port,
    pathname,
  };
}

function extractHost(rawUrl: string): string {
  const parsed = parseStrictUrl(rawUrl);
  return parsed && !parsed.hasCredentials ? parsed.hostname : '';
}

/**
 * Module 3.2 & 4.1 — Strict whitelist for WebSocket URLs accepted by the mobile client.
 * - Cloud/Online endpoints MUST use wss:// and belong to the configured/official realtime host.
 * - Local Wi-Fi peer-to-peer endpoints may use ws:// ONLY on private LAN hosts with valid ports.
 * - Blocks arbitrary third-party servers, public cleartext ws://, and cloud metadata IPs.
 */
export function isAllowedRealtimeWsUrl(
  rawUrl: string,
  configuredOnlineBaseUrl?: string
): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 512) return false;

  const parsed = parseStrictUrl(trimmed);
  if (!parsed || parsed.hasCredentials) return false;

  const { protocol, hostname, pathname, port } = parsed;
  if (protocol !== 'wss:' && protocol !== 'ws:') {
    return false;
  }

  if (!hostname) return false;

  const allowedCloudHosts = new Set<string>(DEFAULT_ALLOWED_REALTIME_HOSTS);
  if (configuredOnlineBaseUrl) {
    const configuredHost = extractHost(configuredOnlineBaseUrl);
    if (configuredHost) {
      allowedCloudHosts.add(configuredHost);
    }
  }

  if (protocol === 'wss:') {
    if (allowedCloudHosts.has(hostname)) {
      return (
        pathname === '' ||
        pathname === '/' ||
        /^\/room\/[A-Za-z0-9]{4,8}$/.test(pathname)
      );
    }
    return isPrivateLanHost(hostname);
  }

  // ws:// is strictly restricted to private LAN hosts on non-privileged ports
  if (!isPrivateLanHost(hostname)) {
    return false;
  }

  if (port) {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
      return false;
    }
  }
  return true;
}

/**
 * Module 4.1 — Ensures public API endpoints strictly use HTTPS (TLS 1.2+).
 * Cleartext http:// is allowed exclusively on local development hosts.
 */
export function isAllowedApiBaseUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 512) return false;

  const parsed = parseStrictUrl(trimmed);
  if (!parsed || parsed.hasCredentials) return false;

  if (parsed.protocol === 'https:') {
    return Boolean(parsed.hostname);
  }
  if (parsed.protocol === 'http:') {
    return isPrivateLanHost(parsed.hostname);
  }
  return false;
}

/**
 * Module 1.2 & 3.2 — Validates incoming deep-link / Universal Link origins before parsing.
 */
export function isAllowedInviteLinkUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1024) return false;

  const parsed = parseStrictUrl(trimmed);
  if (!parsed || parsed.hasCredentials) return false;

  if (parsed.protocol === 'stopmind:') {
    const target = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return target === 'join' || target === 'join/' || target === '/join';
  }
  if (parsed.protocol === 'https:') {
    return (
      ALLOWED_INVITE_WEB_HOSTS.has(parsed.hostname) &&
      (parsed.pathname === '/join' || parsed.pathname === '/join/')
    );
  }
  return false;
}

/**
 * Module 1.2 & 7.2 — Sanitize incoming answers object against allowed category whitelist.
 * Neutralizes prototype pollution, oversized strings, and unexpected category keys.
 */
export function sanitizeIncomingAnswers(
  raw: unknown,
  allowedCategories: readonly string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }

  const source = raw as Record<string, unknown>;
  for (const category of allowedCategories) {
    if (FORBIDDEN_OBJECT_KEYS.has(category)) continue;
    if (!Object.prototype.hasOwnProperty.call(source, category)) continue;
    const value = source[category];
    if (typeof value === 'string') {
      result[category] = sanitizeDisplayText(value, MAX_ANSWER_LENGTH);
    }
  }
  return result;
}

/**
 * Module 6 (API10) & 7.2 — Runtime schema validator for RoomSnapshot received over WebSocket.
 */
export function isValidRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.roomCode !== 'string' || !isValidRoomCode(obj.roomCode)) {
    return false;
  }
  if (
    obj.phase !== 'lobby' &&
    obj.phase !== 'playing' &&
    obj.phase !== 'scoring' &&
    obj.phase !== 'results' &&
    obj.phase !== 'finished'
  ) {
    return false;
  }
  if (typeof obj.hostId !== 'string' || obj.hostId.length === 0) {
    return false;
  }
  if (!Array.isArray(obj.players) || obj.players.length > 32) {
    return false;
  }
  for (const player of obj.players) {
    if (!player || typeof player !== 'object') return false;
    const p = player as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return false;
    if (typeof p.totalScore !== 'number' || !Number.isFinite(p.totalScore)) {
      return false;
    }
  }

  if (!obj.config || typeof obj.config !== 'object') return false;
  const cfg = obj.config as Record<string, unknown>;
  if (!Array.isArray(cfg.categories) || cfg.categories.length === 0 || cfg.categories.length > 20) {
    return false;
  }
  if (typeof cfg.totalRounds !== 'number' || !Number.isFinite(cfg.totalRounds)) {
    return false;
  }
  if (typeof cfg.timeLimitSeconds !== 'number' || !Number.isFinite(cfg.timeLimitSeconds)) {
    return false;
  }

  return true;
}

/**
 * Module 6 (API10) & 7.2 — Runtime schema validator for RoundResults received over WebSocket.
 */
export function isValidRoundResults(value: unknown): value is RoundResults {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.roundNumber !== 'number' || !Number.isFinite(obj.roundNumber)) {
    return false;
  }
  if (typeof obj.totalRounds !== 'number' || !Number.isFinite(obj.totalRounds)) {
    return false;
  }
  if (typeof obj.letter !== 'string' || obj.letter.length === 0 || obj.letter.length > 4) {
    return false;
  }
  if (!Array.isArray(obj.categoryResults) || obj.categoryResults.length > 20) {
    return false;
  }
  if (!Array.isArray(obj.leaderboard) || obj.leaderboard.length > 32) {
    return false;
  }
  return true;
}

/**
 * Module 9.3 — Generates an opaque correlation code (UUID-like) for Fail-Secure screens.
 */
export function generateCorrelationId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (len: number) => {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  };
  return `SM-${pick(4)}-${pick(4)}`;
}

export interface SafeErrorEvent {
  timestampUtc: string;
  correlationId: string;
  where: string;
  severity: 'ERROR' | 'FATAL' | 'WARNING';
  errorName: string;
  code?: string;
}

export type CrashReporterSink = (event: SafeErrorEvent, error: unknown) => void;

let activeCrashReporter: CrashReporterSink | null = null;

/**
 * Pluggable crash/observability hook (ready for Sentry or Crashlytics)
 * without coupling core code to any vendor SDK.
 */
export function setCrashReporter(sink: CrashReporterSink | null): void {
  activeCrashReporter = sink;
}

/**
 * Module 9.1 & 9.3 — Structured 4W-inspired safe error reporting (UTC, Where, What, CorrelationId).
 * - Never includes PII, player names, answers, or raw stack traces in user-visible flows.
 * - Suppresses verbose debug logs outside __DEV__.
 */
export function reportSafeError(params: {
  where: string;
  error: unknown;
  severity?: 'ERROR' | 'FATAL' | 'WARNING';
  code?: string;
  correlationId?: string;
}): SafeErrorEvent {
  const correlationId = params.correlationId ?? generateCorrelationId();
  const errorName =
    params.error instanceof Error
      ? sanitizeDisplayText(params.error.name || 'Error', 40)
      : 'UnknownError';

  const event: SafeErrorEvent = {
    timestampUtc: new Date().toISOString(),
    correlationId,
    where: sanitizeDisplayText(params.where, 60) || 'mobile',
    severity: params.severity ?? 'ERROR',
    errorName,
    ...(params.code ? { code: sanitizeDisplayText(params.code, 32) } : {}),
  };

  if (activeCrashReporter) {
    try {
      activeCrashReporter(event, params.error);
    } catch {
      // Fail-safe: reporter errors must never crash the app
    }
  } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[STOPMind:SafeLog]', JSON.stringify(event));
  }

  return event;
}
