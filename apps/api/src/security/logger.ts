import crypto from 'node:crypto';

export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';

/**
 * Módulo 9.2 — LogEncoder: neutralizes CR/LF and control characters
 * to prevent Log Injection / Log Forging attacks.
 */
export function encodeLogText(value: unknown, maxLen = 160): string {
  const str = typeof value === 'string' ? value : String(value ?? '');
  return str
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * One-way SHA-256 pseudonymization using external pepper so raw IPs / PII
 * are never stored in plaintext logs (Ley 8968 & OWASP A09:2025).
 */
export function hashIdentifier(raw: string, pepper: string): string {
  return crypto
    .createHash('sha256')
    .update(`${raw}|${pepper}`)
    .digest('hex')
    .slice(0, 24);
}

export interface AuditEventInput {
  module: string;
  action: string;
  severity: LogSeverity;
  clientIp: string;
  actorId?: string;
  traceId: string;
  pepper: string;
  details?: Record<string, string | number | boolean>;
}

/**
 * Módulo 9.1 & 9.2 — Structured 4W JSON Audit Logger with SHA-256 + Pepper
 * integrity column for cryptographic non-repudiation. DEBUG is strictly disabled.
 */
export function logAuditEvent(input: AuditEventInput): Record<string, unknown> {
  const safeDetails: Record<string, string | number | boolean> = {};
  if (input.details) {
    for (const [key, val] of Object.entries(input.details)) {
      // Strictly exclude any sensitive key names
      if (/key|token|secret|password|auth|cookie/i.test(key)) continue;
      safeDetails[encodeLogText(key, 40)] =
        typeof val === 'string' ? encodeLogText(val, 120) : val;
    }
  }

  const eventCore = {
    when: new Date().toISOString(), // Mandatory UTC
    where: {
      app: 'stopmind-api',
      module: encodeLogText(input.module, 48),
      ipHash: hashIdentifier(input.clientIp || 'unknown', input.pepper),
    },
    who: input.actorId
      ? hashIdentifier(input.actorId, input.pepper)
      : 'anonymous',
    what: {
      action: encodeLogText(input.action, 64),
      severity: input.severity,
      traceId: encodeLogText(input.traceId, 64),
      details: safeDetails,
    },
  };

  // Non-repudiation integrity digest with external high-entropy pepper
  const integrity = crypto
    .createHash('sha256')
    .update(`${JSON.stringify(eventCore)}|${input.pepper}`)
    .digest('hex');

  const record = {
    ...eventCore,
    integrity,
  };

  if (process.env.NODE_ENV !== 'test') {
    const line = JSON.stringify(record);
    if (input.severity === 'ERROR' || input.severity === 'FATAL') {
      console.error(line);
    } else if (input.severity === 'WARNING') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return record;
}
