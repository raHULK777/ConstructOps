import type { RequestHandler } from 'express';
import { unsupportedMediaType } from '../utils/errors';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * MIME processing matrix: JSON only, multipart streaming rejected
 * (api.md, section 1). A genuinely bodyless PUT (such as change-order approval)
 * is allowed through; anything carrying a payload must declare JSON.
 */
export function requireJsonBody(): RequestHandler {
  return (req, _res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const hasBody =
      (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0') ||
      req.headers['transfer-encoding'] !== undefined;

    if (!hasBody) {
      next();
      return;
    }

    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      next(unsupportedMediaType());
      return;
    }

    next();
  };
}
