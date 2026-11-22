import {
  DynamoDBClient,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { hashIdentifier } from './logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const dynamo = new DynamoDBClient({});
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Módulo 6 (OWASP API4:2023) & Módulo 8 (LLM10) — Anti-DoS / Anti-Denial-of-Wallet
 * Fixed 1-minute window rate limiter backed by DynamoDB TTL in AWS, with in-memory fallback locally.
 * Uses hashed client identity so raw IPs are never persisted.
 */
export async function checkRateLimit(params: {
  clientKey: string;
  pepper: string;
  limitPerMinute: number;
  tableName?: string;
}): Promise<RateLimitResult> {
  const { clientKey, pepper, limitPerMinute, tableName } = params;
  const nowSec = Math.floor(Date.now() / 1000);
  const minuteBucket = Math.floor(nowSec / 60);
  const retryAfterSeconds = Math.max(1, (minuteBucket + 1) * 60 - nowSec);
  const hashed = hashIdentifier(clientKey || 'anon', pepper);
  const pk = `RL#${hashed}#${minuteBucket}`;

  if (tableName) {
    try {
      const ttl = (minuteBucket + 2) * 60;
      const res = await dynamo.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: { pk: { S: pk } },
          UpdateExpression: 'ADD hits :one SET #ttl = if_not_exists(#ttl, :ttl)',
          ExpressionAttributeNames: { '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':one': { N: '1' },
            ':ttl': { N: String(ttl) },
          },
          ReturnValues: 'UPDATED_NEW',
        })
      );
      const count = Number(res.Attributes?.hits?.N ?? 1);
      return {
        allowed: count <= limitPerMinute,
        remaining: Math.max(0, limitPerMinute - count),
        retryAfterSeconds,
      };
    } catch {
      // Fail-Secure: if DynamoDB rate-limit store fails unexpectedly in prod, fall back to strict memory guard
    }
  }

  // In-memory rate limiter (local dev & Lambda warm-container fallback)
  const nowMs = Date.now();
  const existing = memoryBuckets.get(pk);
  if (!existing || existing.resetAt <= nowMs) {
    // Periodic bound to prevent memory DoS (Módulo 9.3)
    if (memoryBuckets.size > 2000) {
      memoryBuckets.clear();
    }
    memoryBuckets.set(pk, {
      count: 1,
      resetAt: (minuteBucket + 1) * 60 * 1000,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limitPerMinute - 1),
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limitPerMinute,
    remaining: Math.max(0, limitPerMinute - existing.count),
    retryAfterSeconds,
  };
}

export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}
