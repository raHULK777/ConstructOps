import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { Env } from '../config/env';

/**
 * Rate limiting is part of the public surface: tenant resolution, login and the
 * estimator are all callable without a session. Tests skip it so limits never
 * make the suite flaky.
 */
export function createRateLimiter(env: Env, max: number, scope: string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
        requestId: req.id,
        scope,
      });
    },
  });
}
