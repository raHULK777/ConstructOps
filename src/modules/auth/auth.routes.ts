import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { createRateLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../utils/validation';
import { createAuthController } from './auth.controller';
import { loginBodySchema, refreshBodySchema } from './auth.schemas';

export function createAuthRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createAuthController(deps);
  const limiter = createRateLimiter(deps.env, deps.env.authRateLimitMax, 'auth');

  router.post('/login', limiter, validateBody(loginBodySchema), controller.login);
  router.post('/refresh', limiter, validateBody(refreshBodySchema), controller.refresh);
  router.post('/logout', limiter, validateBody(refreshBodySchema), controller.logout);

  return router;
}
