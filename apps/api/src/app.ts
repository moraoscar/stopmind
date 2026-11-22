import crypto from 'node:crypto';
import { Hono } from 'hono';
import {
  ApiValidateVerdict,
  makeValidationKey,
  validateWordLocally,
} from '@stopmind/shared';
import { getAppSettings, getRuntimeSecrets, RuntimeSecrets } from './config';
import { securityHeadersMiddleware } from './security/headers';
import { logAuditEvent } from './security/logger';
import { checkRateLimit } from './security/rateLimit';
import {
  HintRequestSchema,
  MAX_PAYLOAD_BYTES,
  ValidateRoundRequestSchema,
} from './security/schemas';
import {
  CachedVerdict,
  getCachedVerdicts,
  putCachedVerdicts,
} from './services/cache';
import {
  evaluateWithGemini,
  FetchLike,
  GeminiEvalItem,
  generateHintWithGemini,
} from './services/gemini';

export interface CreateAppOptions {
  secretsLoader?: () => Promise<RuntimeSecrets>;
  fetchImpl?: FetchLike;
  rateLimitPerMinute?: number;
  dynamoTableName?: string;
  allowedOrigins?: string[];
}

function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

export function createApiApp(options: CreateAppOptions = {}) {
  const settings = getAppSettings();
  const secretsLoader = options.secretsLoader ?? getRuntimeSecrets;
  const fetchImpl = options.fetchImpl ?? fetch;
  const rateLimitPerMinute =
    options.rateLimitPerMinute ?? settings.rateLimitPerMinute;
  const dynamoTableName = options.dynamoTableName ?? settings.dynamoTableName;
  const allowedOrigins = options.allowedOrigins ?? settings.allowedOrigins;

  const app = new Hono();

  // Módulo 5: Strict security headers + whitelist-only CORS
  app.use('*', securityHeadersMiddleware(allowedOrigins));

  // Módulo 6 (OWASP API4) & Módulo 8 (LLM10): Hard payload ceiling (4 KB)
  app.use('/v1/*', async (c, next) => {
    const contentLength = Number(c.req.header('content-length') ?? 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return c.json(
        { error: 'Payload too large', traceId: crypto.randomUUID() },
        413
      );
    }
    await next();
  });

  // Módulo 9.3: Global opaque exception handler — NEVER leaks stack traces or internals
  app.onError(async (err, c) => {
    const traceId = crypto.randomUUID();
    const secrets = await secretsLoader().catch(() => ({
      geminiApiKey: '',
      logPepper: 'fallback-pepper',
    }));

    logAuditEvent({
      module: 'global-error',
      action: 'UNHANDLED_EXCEPTION',
      severity: 'ERROR',
      clientIp: getClientIp(c.req.raw.headers),
      actorId: c.req.header('x-client-id'),
      traceId,
      pepper: secrets.logPepper,
      details: {
        errorName: err instanceof Error ? err.name : 'UnknownError',
        path: c.req.path,
      },
    });

    return c.json({ error: 'Internal service error', traceId }, 500);
  });

  app.notFound((c) => {
    return c.json({ error: 'Not found', traceId: crypto.randomUUID() }, 404);
  });

  app.get('/v1/health', (c) => {
    return c.json({
      ok: true,
      service: 'stopmind-api',
      timestampUtc: new Date().toISOString(),
    });
  });

  app.post('/v1/validate-round', async (c) => {
    const traceId = crypto.randomUUID();
    const clientIp = getClientIp(c.req.raw.headers);
    const clientId = c.req.header('x-client-id') ?? clientIp;
    const secrets = await secretsLoader();

    // Rate limiting (Anti-DoS / Anti-DoW)
    const rl = await checkRateLimit({
      clientKey: `${clientIp}:${clientId}`,
      pepper: secrets.logPepper,
      limitPerMinute: rateLimitPerMinute,
      tableName: dynamoTableName || undefined,
    });

    if (!rl.allowed) {
      logAuditEvent({
        module: 'validate-round',
        action: 'RATE_LIMIT_EXCEEDED',
        severity: 'WARNING',
        clientIp,
        actorId: clientId,
        traceId,
        pepper: secrets.logPepper,
        details: { retryAfter: rl.retryAfterSeconds },
      });
      c.header('Retry-After', String(rl.retryAfterSeconds));
      return c.json({ error: 'Too many requests', traceId }, 429);
    }

    // Strict raw body size guard even when Content-Length header is omitted
    const rawBodyText = await c.req.text();
    if (Buffer.byteLength(rawBodyText, 'utf8') > MAX_PAYLOAD_BYTES) {
      return c.json({ error: 'Payload too large', traceId }, 413);
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBodyText);
    } catch {
      return c.json({ error: 'Invalid JSON payload', traceId }, 400);
    }

    // Módulo 1.2: Canonicalization -> Deterministic Zod whitelist validation
    const parsed = ValidateRoundRequestSchema.safeParse(rawJson);
    if (!parsed.success) {
      logAuditEvent({
        module: 'validate-round',
        action: 'INPUT_VALIDATION_REJECTED',
        severity: 'WARNING',
        clientIp,
        actorId: clientId,
        traceId,
        pepper: secrets.logPepper,
        details: { issueCount: parsed.error.issues.length },
      });
      return c.json({ error: 'Invalid request parameters', traceId }, 400);
    }

    const items = parsed.data.items;
    const verdictsById = new Map<number, ApiValidateVerdict>();
    const candidates: GeminiEvalItem[] = [];

    // Layer 1: Deterministic local filter (zero Gemini tokens spent on obvious junk)
    for (const item of items) {
      const localCheck = validateWordLocally(item.word);
      if (!localCheck.valid) {
        verdictsById.set(item.id, {
          id: item.id,
          valid: false,
          reason: localCheck.reason ?? 'Palabra no válida',
          source: 'local',
        });
        continue;
      }

      const key = makeValidationKey(item.category, item.word);
      candidates.push({
        id: item.id,
        key,
        category: item.category,
        word: item.word,
      });
    }

    // Layer 2A: DynamoDB / memory persistent cache lookup
    const uniqueKeys = [...new Set(candidates.map((item) => item.key))];
    const cachedMap = await getCachedVerdicts(
      uniqueKeys,
      dynamoTableName || undefined
    );

    const uncached: GeminiEvalItem[] = [];
    const seenUncached = new Set<string>();
    let usedAi = false;

    for (const item of candidates) {
      const cached = cachedMap.get(item.key);
      if (cached) {
        usedAi = true;
        verdictsById.set(item.id, {
          id: item.id,
          valid: cached.valid,
          reason: cached.reason,
          source: 'cache',
        });
      } else if (!seenUncached.has(item.key)) {
        seenUncached.add(item.key);
        uncached.push(item);
      }
    }

    // Layer 2B: Single batched Gemini Free-Tier evaluation for uncached valid words
    if (uncached.length > 0 && secrets.geminiApiKey) {
      const aiRes = await evaluateWithGemini({
        items: uncached,
        apiKey: secrets.geminiApiKey,
        fetchImpl,
      });

      if (aiRes.usedAi) {
        usedAi = true;
        const toPersist = new Map<string, CachedVerdict>();
        for (const [key, verdict] of aiRes.verdicts.entries()) {
          toPersist.set(key, verdict);
        }
        await putCachedVerdicts(toPersist, dynamoTableName || undefined);

        for (const item of candidates) {
          if (verdictsById.has(item.id)) continue;
          const v = aiRes.verdicts.get(item.key);
          if (v) {
            verdictsById.set(item.id, {
              id: item.id,
              valid: v.valid,
              reason: v.reason,
              source: 'gemini',
            });
          }
        }
      }
    }

    // Any remaining candidate (if Gemini unavailable/rate-limited) falls back cleanly to Layer 1 local pass
    for (const item of candidates) {
      if (!verdictsById.has(item.id)) {
        verdictsById.set(item.id, {
          id: item.id,
          valid: true,
          reason: '',
          source: 'local',
        });
      }
    }

    const verdicts = items.map(
      (item) =>
        verdictsById.get(item.id) ?? {
          id: item.id,
          valid: false,
          reason: 'Error de validación',
          source: 'local' as const,
        }
    );

    logAuditEvent({
      module: 'validate-round',
      action: 'ROUND_VALIDATED',
      severity: 'INFO',
      clientIp,
      actorId: clientId,
      traceId,
      pepper: secrets.logPepper,
      details: {
        totalItems: items.length,
        cacheHits: cachedMap.size,
        geminiQueried: uncached.length,
        usedAi,
      },
    });

    return c.json({ verdicts, usedAi });
  });

  app.post('/v1/hint', async (c) => {
    const traceId = crypto.randomUUID();
    const clientIp = getClientIp(c.req.raw.headers);
    const clientId = c.req.header('x-client-id') ?? clientIp;
    const secrets = await secretsLoader();

    const rl = await checkRateLimit({
      clientKey: `hint:${clientIp}:${clientId}`,
      pepper: secrets.logPepper,
      limitPerMinute: rateLimitPerMinute,
      tableName: dynamoTableName || undefined,
    });

    if (!rl.allowed) {
      c.header('Retry-After', String(rl.retryAfterSeconds));
      return c.json({ error: 'Too many requests', traceId }, 429);
    }

    const rawBodyText = await c.req.text();
    if (Buffer.byteLength(rawBodyText, 'utf8') > MAX_PAYLOAD_BYTES) {
      return c.json({ error: 'Payload too large', traceId }, 413);
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBodyText);
    } catch {
      return c.json({ error: 'Invalid JSON payload', traceId }, 400);
    }

    const parsed = HintRequestSchema.safeParse(rawJson);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request parameters', traceId }, 400);
    }

    const word = await generateHintWithGemini({
      category: parsed.data.category,
      letter: parsed.data.letter,
      apiKey: secrets.geminiApiKey,
      fetchImpl,
    });

    return c.json({ word });
  });

  return app;
}
