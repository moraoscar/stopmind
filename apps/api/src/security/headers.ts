import type { MiddlewareHandler } from 'hono';

/**
 * Módulo 5.1 & 5.2 — Strict HTTP Security Headers & Whitelist-only CORS.
 * Never uses wildcard '*' CORS and suppresses technology-revealing headers.
 */
export function securityHeadersMiddleware(
  allowedOrigins: string[]
): MiddlewareHandler {
  const originSet = new Set(allowedOrigins);

  return async (c, next) => {
    const origin = c.req.header('origin');
    const isAllowedOrigin = Boolean(origin && originSet.has(origin));

    if (c.req.method === 'OPTIONS') {
      if (isAllowedOrigin && origin) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        c.header('Access-Control-Allow-Headers', 'Content-Type, X-Client-Id');
        c.header('Vary', 'Origin');
      }
      return c.body(null, 204);
    }

    await next();

    c.header(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'"
    );
    c.header('X-Frame-Options', 'DENY');
    c.header('Cache-Control', 'no-store');
    c.res.headers.delete('X-Powered-By');
    c.res.headers.delete('Server');

    if (isAllowedOrigin && origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Vary', 'Origin');
    }
  };
}
