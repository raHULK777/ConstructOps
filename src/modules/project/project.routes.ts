import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validateBody, validateParams, validateQuery } from '../../utils/validation';
import { createProjectController } from './project.controller';
import {
  createProjectBodySchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProgressBodySchema,
} from './project.schemas';

export function createProjectRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createProjectController(deps);

  router.use(authenticate(deps));

  router.get('/', validateQuery(listProjectsQuerySchema), controller.list);
  router.post(
    '/',
    requireRole('admin'),
    validateBody(createProjectBodySchema),
    controller.create,
  );
  router.get('/:id', validateParams(projectIdParamsSchema), controller.get);
  router.put(
    '/:id/progress',
    requireRole('admin', 'field_staff'),
    validateParams(projectIdParamsSchema),
    validateBody(updateProgressBodySchema),
    controller.updateProgress,
  );
  router.delete(
    '/:id',
    requireRole('admin'),
    validateParams(projectIdParamsSchema),
    controller.remove,
  );

  return router;
}
