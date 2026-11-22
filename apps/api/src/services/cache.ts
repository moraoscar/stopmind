import {
  BatchGetItemCommand,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

export interface CachedVerdict {
  valid: boolean;
  reason: string;
}

const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const MAX_MEMORY_ENTRIES = 5000; // Guard against unbounded RAM growth (Módulo 9.3)

const dynamo = new DynamoDBClient({});
const memoryCache = new Map<string, CachedVerdict>();

export async function getCachedVerdicts(
  keys: string[],
  tableName?: string
): Promise<Map<string, CachedVerdict>> {
  const result = new Map<string, CachedVerdict>();
  const missing: string[] = [];

  for (const key of keys) {
    const local = memoryCache.get(key);
    if (local) {
      result.set(key, local);
    } else {
      missing.push(key);
    }
  }

  if (!tableName || missing.length === 0) {
    return result;
  }

  try {
    const res = await dynamo.send(
      new BatchGetItemCommand({
        RequestItems: {
          [tableName]: {
            Keys: missing.slice(0, 25).map((k) => ({ pk: { S: `WORD#${k}` } })),
          },
        },
      })
    );
    const rows = res.Responses?.[tableName] ?? [];
    for (const row of rows) {
      const rawPk = row.pk?.S;
      if (!rawPk || !rawPk.startsWith('WORD#')) continue;
      const key = rawPk.slice(5);
      const verdict: CachedVerdict = {
        valid: Boolean(row.valid?.BOOL),
        reason: row.reason?.S ?? '',
      };
      setMemoryEntry(key, verdict);
      result.set(key, verdict);
    }
  } catch {
    // Non-fatal cache miss: proceed to Gemini validation
  }

  return result;
}

export async function putCachedVerdicts(
  entries: Map<string, CachedVerdict>,
  tableName?: string
): Promise<void> {
  if (entries.size === 0) return;
  const ttl = Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS;

  const writes: Promise<unknown>[] = [];
  for (const [key, verdict] of entries.entries()) {
    setMemoryEntry(key, verdict);
    if (tableName) {
      writes.push(
        dynamo
          .send(
            new PutItemCommand({
              TableName: tableName,
              Item: {
                pk: { S: `WORD#${key}` },
                valid: { BOOL: verdict.valid },
                reason: { S: verdict.reason },
                ttl: { N: String(ttl) },
              },
            })
          )
          .catch(() => undefined)
      );
    }
  }
  await Promise.all(writes);
}

function setMemoryEntry(key: string, verdict: CachedVerdict): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, verdict);
}

export function clearMemoryCache(): void {
  memoryCache.clear();
}
