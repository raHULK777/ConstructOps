import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../utils/logger';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Assigns a correlation id to every request (honouring a well-formed inbound
 * x-request-id) and emits one access log line on completion.
 */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inbound = req.header('x-request-id');
    req.id = inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : randomUUID();
    res.setHeader('x-request-id', req.id);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info('request completed', {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      });
    });

    next();
  };
}
