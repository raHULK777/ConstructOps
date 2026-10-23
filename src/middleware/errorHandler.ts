import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isAppError, notFound, type ErrorCode } from '../utils/errors';
import type { Logger } from '../utils/logger';

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => {
    next(notFound('Route not found.'));
  };
}

interface NormalizedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
}

function normalizeError(error: unknown): NormalizedError {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.expose ? error.message : 'Internal server error.',
    };
  }

  const parserError = error as { type?: string };
  if (parserError?.type === 'entity.parse.failed') {
    return { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' };
  }
  if (parserError?.type === 'entity.too.large') {
    return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error.' };
}

/**
 * Terminal error handler. Client-safe messages only; stacks and driver details
 * stay in the server log, keyed by the request id echoed to the caller.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalized = normalizeError(error);

    if (normalized.statusCode >= 500) {
      logger.error('Request failed', {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: normalized.statusCode,
        code: normalized.code,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    res.status(normalized.statusCode).json({
      success: false,
      error: normalized.message,
      code: normalized.code,
      requestId: req.id,
    });
  };
}
