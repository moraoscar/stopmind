import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, type RoomSnapshot, type RoundResults } from '@stopmind/shared';
import {
  BoundedMap,
  canonicalizeRoomCode,
  generateCorrelationId,
  isAllowedApiBaseUrl,
  isAllowedInviteLinkUrl,
  isAllowedRealtimeWsUrl,
  isPrivateLanHost,
  isValidRoomSnapshot,
  isValidRoundResults,
  reportSafeError,
  sanitizeDisplayText,
  sanitizeIncomingAnswers,
  setCrashReporter,
  type SafeErrorEvent,
} from '../utils/security';

test('Module 9.3 — BoundedMap enforces upper bound and evicts oldest entry', () => {
  const cache = new BoundedMap<string, number>(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.size, 3);

  cache.set('d', 4);
  assert.equal(cache.size, 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('d'), 4);
});

test('Module 1.2 — canonicalizeRoomCode enforces strict alphanumeric whitelist', () => {
  assert.equal(canonicalizeRoomCode('  ab12\n '), 'AB12');
  assert.equal(canonicalizeRoomCode('ABCD56'), 'ABCD56');
  assert.equal(canonicalizeRoomCode('AB'), '');
  assert.equal(canonicalizeRoomCode('AB$%'), '');
  assert.equal(canonicalizeRoomCode('ABCDEFGHI'), '');
  assert.equal(canonicalizeRoomCode(null), '');
});

test('Module 3.2 — isPrivateLanHost allows RFC1918/local and blocks cloud metadata & public IPs', () => {
  assert.equal(isPrivateLanHost('192.168.1.42'), true);
  assert.equal(isPrivateLanHost('10.0.0.5'), true);
  assert.equal(isPrivateLanHost('172.16.4.10'), true);
  assert.equal(isPrivateLanHost('172.31.255.1'), true);
  assert.equal(isPrivateLanHost('localhost'), true);
  assert.equal(isPrivateLanHost('iphone-oscar.local'), true);

  // Blocked: AWS/GCP metadata, public IPs, out-of-range octets
  assert.equal(isPrivateLanHost('169.254.169.254'), false);
  assert.equal(isPrivateLanHost('172.32.0.1'), false);
  assert.equal(isPrivateLanHost('8.8.8.8'), false);
  assert.equal(isPrivateLanHost('evil.example.com'), false);
  assert.equal(isPrivateLanHost('999.168.1.1'), false);
});

test('Module 3.2 & 4.1 — isAllowedRealtimeWsUrl enforces strict whitelist and TLS for cloud', () => {
  const officialOnline = 'wss://stopmind-realtime.stopmind.workers.dev';

  // Allowed: official cloud WSS & private LAN WS
  assert.equal(
    isAllowedRealtimeWsUrl(`${officialOnline}/room/ABCD`, officialOnline),
    true
  );
  assert.equal(
    isAllowedRealtimeWsUrl('ws://192.168.1.25:3001', officialOnline),
    true
  );
  assert.equal(
    isAllowedRealtimeWsUrl('ws://10.0.1.9:3001', officialOnline),
    true
  );

  // Blocked: third-party WSS, cleartext cloud WS, metadata IP, credentials, privileged ports
  assert.equal(
    isAllowedRealtimeWsUrl('wss://attacker.example.com/room/ABCD', officialOnline),
    false
  );
  assert.equal(
    isAllowedRealtimeWsUrl('ws://stopmind-realtime.stopmind.workers.dev/room/ABCD', officialOnline),
    false
  );
  assert.equal(
    isAllowedRealtimeWsUrl('ws://169.254.169.254:80', officialOnline),
    false
  );
  assert.equal(
    isAllowedRealtimeWsUrl('ws://192.168.1.25:22', officialOnline),
    false
  );
  assert.equal(
    isAllowedRealtimeWsUrl('wss://user:pass@stopmind-realtime.stopmind.workers.dev/room/ABCD', officialOnline),
    false
  );
  assert.equal(
    isAllowedRealtimeWsUrl('javascript:alert(1)', officialOnline),
    false
  );
});

test('Module 4.1 — isAllowedApiBaseUrl enforces HTTPS on public hosts', () => {
  assert.equal(
    isAllowedApiBaseUrl('https://fhkmc2g834.execute-api.us-east-1.amazonaws.com/prod'),
    true
  );
  assert.equal(isAllowedApiBaseUrl('http://localhost:8787'), true);
  assert.equal(isAllowedApiBaseUrl('http://api.example.com/prod'), false);
  assert.equal(isAllowedApiBaseUrl('ftp://api.example.com'), false);
});

test('Module 1.2 & 3.2 — isAllowedInviteLinkUrl allows only official scheme/domain', () => {
  assert.equal(
    isAllowedInviteLinkUrl('https://stopmind.cxvone.com/join?room=ABCD'),
    true
  );
  assert.equal(
    isAllowedInviteLinkUrl('stopmind://join?room=ABCD&ws=ws%3A%2F%2F192.168.1.10%3A3001'),
    true
  );
  assert.equal(
    isAllowedInviteLinkUrl('https://phishing.example.com/join?room=ABCD'),
    false
  );
  assert.equal(
    isAllowedInviteLinkUrl('http://stopmind.cxvone.com/join?room=ABCD'),
    false
  );
});

test('Module 1.2 & 7.2 — sanitizeIncomingAnswers filters unknown keys, control chars, and prototype pollution', () => {
  const raw = JSON.parse(
    '{"Nombre":"  Ana\\u0000\\n  ","Pais":"Colombia","Extra":"hack","__proto__":{"polluted":true}}'
  );
  const clean = sanitizeIncomingAnswers(raw, ['Nombre', 'Pais', 'Fruta']);
  assert.deepEqual(clean, { Nombre: 'Ana', Pais: 'Colombia' });
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('Module 6 (API10) & 7.2 — runtime schema validators accept valid payloads and reject malformed ones', () => {
  const validSnapshot: RoomSnapshot = {
    roomCode: 'ABCD',
    phase: 'lobby',
    hostId: 'host_1',
    currentRound: 0,
    currentLetter: '',
    roundEndsAt: null,
    serverNow: Date.now(),
    serverIps: ['192.168.1.10'],
    serverPort: 3001,
    players: [
      {
        id: 'host_1',
        name: 'Oscar',
        isHost: true,
        totalScore: 0,
        filledCount: 0,
        connected: true,
      },
    ],
    config: { ...DEFAULT_CONFIG },
  };
  assert.equal(isValidRoomSnapshot(validSnapshot), true);
  assert.equal(isValidRoomSnapshot({ ...validSnapshot, roomCode: 'BAD!' }), false);
  assert.equal(isValidRoomSnapshot({ ...validSnapshot, phase: 'hacked' }), false);
  assert.equal(isValidRoomSnapshot(null), false);

  const validResults: RoundResults = {
    roundNumber: 1,
    totalRounds: 3,
    letter: 'M',
    stopReason: 'stop',
    stoppedByName: 'Oscar',
    categoryResults: [],
    roundScores: { host_1: 100 },
    leaderboard: [],
    isFinalRound: false,
    validatedBy: 'local',
  };
  assert.equal(isValidRoundResults(validResults), true);
  assert.equal(isValidRoundResults({ ...validResults, roundNumber: Number.NaN }), false);
  assert.equal(isValidRoundResults({ ...validResults, letter: 'TOOLONG' }), false);
});

test('Module 8 (LLM05) & 9.1/9.3 — sanitizeDisplayText and reportSafeError redact and invoke pluggable sink', () => {
  assert.equal(sanitizeDisplayText('  Manzana\r\n\t ', 10), 'Manzana');
  assert.equal(sanitizeDisplayText('A'.repeat(200), 40).length, 40);

  const id = generateCorrelationId();
  assert.match(id, /^SM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  const captured: SafeErrorEvent[] = [];
  setCrashReporter((event) => {
    captured.push(event);
  });
  try {
    const ev = reportSafeError({
      where: 'TestModule',
      error: new TypeError('sensitive stack detail'),
      severity: 'FATAL',
      correlationId: 'SM-TEST-1234',
    });
    assert.equal(ev.correlationId, 'SM-TEST-1234');
    assert.equal(ev.errorName, 'TypeError');
    assert.equal(captured.length, 1);
    assert.equal(captured[0]?.where, 'TestModule');
  } finally {
    setCrashReporter(null);
  }
});
