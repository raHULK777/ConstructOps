import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { createRateLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../utils/validation';
import { createAuthController } from './auth.controller';
import { loginBodySchema, refreshBodySchema, forgotPasswordBodySchema, resetPasswordBodySchema } from './auth.schemas';

export function createAuthRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createAuthController(deps);
  const limiter = createRateLimiter(deps.env, deps.env.authRateLimitMax, 'auth');

  router.post('/login', limiter, validateBody(loginBodySchema), controller.login);
  router.post('/refresh', limiter, validateBody(refreshBodySchema), controller.refresh);
  router.post('/logout', limiter, validateBody(refreshBodySchema), controller.logout);
  router.post(
    '/forgot-password',
    limiter,
    validateBody(forgotPasswordBodySchema),
    controller.forgotPassword,
  );
  router.post(
    '/reset-password',
    limiter,
    validateBody(resetPasswordBodySchema),
    controller.resetPassword,
  );

  return router;
}
