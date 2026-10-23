import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { createRateLimiter } from '../../middleware/rateLimit';
import { validateBody } from '../../utils/validation';
import { createAuthController } from './auth.controller';
import { loginBodySchema } from './auth.schemas';

export function createAuthRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createAuthController(deps);

  router.post(
    '/login',
    createRateLimiter(deps.env, deps.env.authRateLimitMax, 'auth'),
    validateBody(loginBodySchema),
    controller.login,
  );

  return router;
}
