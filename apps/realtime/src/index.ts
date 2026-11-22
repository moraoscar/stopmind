import {
  isValidRoomCode,
  OnlineRoomEngine,
  validateRoundViaAwsApi,
} from './roomEngine';

export interface Env {
  ROOMS: DurableObjectNamespace;
  VALIDATION_API_URL?: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) {
    out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  }
  return out;
}

export class StopMindRoomDO implements DurableObject {
  private readonly env: Env;
  private readonly sockets = new Map<string, WebSocket>();
  private readonly timers = new Map<'round' | 'finalize', ReturnType<typeof setTimeout>>();
  private engine: OnlineRoomEngine | null = null;
  private seq = 0;

  constructor(_state: DurableObjectState, env: Env) {
    this.env = env;
  }

  private ensureEngine(roomCode: string): OnlineRoomEngine {
    if (!this.engine) {
      this.engine = new OnlineRoomEngine(roomCode, {
        sendTo: (clientId, payload) => {
          const ws = this.sockets.get(clientId);
          if (!ws) return;
          try {
            ws.send(JSON.stringify(payload));
          } catch {
            // ignore closed socket
          }
        },
        broadcast: (payload) => {
          const text = JSON.stringify(payload);
          for (const ws of this.sockets.values()) {
            try {
              ws.send(text);
            } catch {
              // ignore closed socket
            }
          }
        },
        scheduleTimer: (key, delayMs, fn) => {
          const existing = this.timers.get(key);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            this.timers.delete(key);
            fn();
          }, delayMs);
          this.timers.set(key, t);
        },
        clearTimer: (key) => {
          const existing = this.timers.get(key);
          if (existing) {
            clearTimeout(existing);
            this.timers.delete(key);
          }
        },
        validateWords: async (items) => {
          const apiBaseUrl = this.env.VALIDATION_API_URL ?? '';
          return validateRoundViaAwsApi({ apiBaseUrl, items });
        },
      });
    }
    return this.engine;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response(
        JSON.stringify({ error: 'Expected WebSocket upgrade' }),
        { status: 426, headers: SECURITY_HEADERS }
      );
    }

    const url = new URL(request.url);
    const roomCode = (url.searchParams.get('code') ?? '').trim().toUpperCase();
    if (!isValidRoomCode(roomCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid room code' }),
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const engine = this.ensureEngine(roomCode);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const clientId = `p_${++this.seq}_${crypto.randomUUID().slice(0, 6)}`;
    this.sockets.set(clientId, server);

    server.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        engine.handleMessage(clientId, event.data);
      }
    });

    const cleanup = () => {
      if (!this.sockets.has(clientId)) return;
      this.sockets.delete(clientId);
      engine.handleDisconnect(clientId);
    };

    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'stopmind-realtime',
          timestampUtc: new Date().toISOString(),
        }),
        { status: 200, headers: SECURITY_HEADERS }
      );
    }

    if (request.method === 'POST' && url.pathname === '/rooms') {
      return new Response(
        JSON.stringify({ roomCode: generateRoomCode() }),
        { status: 201, headers: SECURITY_HEADERS }
      );
    }

    const roomMatch = /^\/room\/([A-Za-z0-9]{4,6})$/.exec(url.pathname);
    if (roomMatch) {
      const code = roomMatch[1].toUpperCase();
      if (!isValidRoomCode(code)) {
        return new Response(
          JSON.stringify({ error: 'Invalid room code' }),
          { status: 400, headers: SECURITY_HEADERS }
        );
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: SECURITY_HEADERS }
    );
  },
};
