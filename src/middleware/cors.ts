import type { RequestHandler } from 'express';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Authorization,Content-Type,X-Request-Id';

/**
 * Explicit CORS for the white-label frontends. Origins are configured per
 * deployment; no wildcard is emitted unless an operator literally configures it.
 */
export function corsMiddleware(origins: string[]): RequestHandler {
  const allowList = new Set(origins);

  return (req, res, next) => {
    const origin = req.header('origin')?.toLowerCase();

    if (origin && (allowList.has(origin) || allowList.has('*'))) {
      res.setHeader('Access-Control-Allow-Origin', allowList.has('*') ? '*' : origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
