import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export interface RuntimeSecrets {
  geminiApiKey: string;
  logPepper: string;
}

const ssmClient = new SSMClient({});
let cachedSecrets: RuntimeSecrets | null = null;
let cachedAt = 0;
const SECRETS_TTL_MS = 10 * 60 * 1000; // Refresh from SSM every 10 minutes max

async function readSsmParameter(name: string): Promise<string> {
  if (!name) return '';
  try {
    const res = await ssmClient.send(
      new GetParameterCommand({
        Name: name,
        WithDecryption: true,
      })
    );
    return res.Parameter?.Value?.trim() ?? '';
  } catch (err) {
    console.warn(
      JSON.stringify({
        module: 'config',
        action: 'SSM_READ_FAILED',
        param: name,
        errorName: err instanceof Error ? err.name : 'UnknownError',
      })
    );
    return '';
  }
}

/**
 * Loads secrets securely from AWS SSM Parameter Store (SecureString KMS, $0 Standard Tier)
 * in production, or from local env vars in development. Never logs secrets.
 */
export async function getRuntimeSecrets(): Promise<RuntimeSecrets> {
  const now = Date.now();
  if (cachedSecrets && now - cachedAt < SECRETS_TTL_MS) {
    return cachedSecrets;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const ssmGeminiParam = process.env.SSM_GEMINI_KEY_PARAM?.trim() ?? '';
  const ssmPepperParam = process.env.SSM_LOG_PEPPER_PARAM?.trim() ?? '';

  let geminiApiKey = isProd ? '' : (process.env.GEMINI_API_KEY?.trim() ?? '');
  let logPepper = isProd ? '' : (process.env.LOG_PEPPER?.trim() ?? 'dev-pepper');

  if (ssmGeminiParam) {
    const ssmVal = await readSsmParameter(ssmGeminiParam);
    if (ssmVal) geminiApiKey = ssmVal;
  }
  if (ssmPepperParam) {
    const ssmVal = await readSsmParameter(ssmPepperParam);
    if (ssmVal) logPepper = ssmVal;
  }

  cachedSecrets = {
    geminiApiKey,
    logPepper: logPepper || 'ephemeral-fallback-pepper',
  };
  cachedAt = now;
  return cachedSecrets;
}

export function getAppSettings() {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    isProd: process.env.NODE_ENV === 'production',
    dynamoTableName: process.env.DYNAMODB_TABLE_NAME?.trim() ?? '',
    rateLimitPerMinute: Math.max(
      1,
      Math.min(120, Number(process.env.RATE_LIMIT_MAX_PER_MINUTE ?? 20))
    ),
    allowedOrigins,
  };
}
