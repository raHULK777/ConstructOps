import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { requireFeature } from '../../middleware/requireFeature';
import { validateBody } from '../../utils/validation';
import { createEstimatorController } from './estimator.controller';
import { estimateBodySchema } from './estimator.schemas';

export function createEstimatorRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createEstimatorController(deps);

  // Public lead-generation tool, gated by the tenant's paid module flag.
  router.post(
    '/estimate',
    requireFeature('enable_estimator'),
    validateBody(estimateBodySchema),
    controller.estimate,
  );

  return router;
}
