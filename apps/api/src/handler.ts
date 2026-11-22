import { handle } from 'hono/aws-lambda';
import type { LambdaContext, LambdaEvent } from 'hono/aws-lambda';
import { createApiApp } from './app';

const app = createApiApp();
const honoHandler = handle(app);

function stripApiGatewayStagePrefix(event: LambdaEvent): LambdaEvent {
  if (!event || typeof event !== 'object') return event;
  const e = event as unknown as {
    rawPath?: string;
    requestContext?: {
      stage?: string;
      http?: { path?: string };
    };
  };
  const stage = e.requestContext?.stage;
  if (!stage || stage === '$default') return event;

  const prefix = `/${stage}`;
  const rawPath = e.rawPath;
  if (typeof rawPath === 'string' && (rawPath === prefix || rawPath.startsWith(`${prefix}/`))) {
    const stripped = rawPath.slice(prefix.length) || '/';
    return {
      ...event,
      rawPath: stripped,
      requestContext: {
        ...e.requestContext,
        http: e.requestContext?.http
          ? { ...e.requestContext.http, path: stripped }
          : undefined,
      },
    } as LambdaEvent;
  }
  return event;
}

export const handler = (event: LambdaEvent, context?: LambdaContext) =>
  honoHandler(stripApiGatewayStagePrefix(event), context);
