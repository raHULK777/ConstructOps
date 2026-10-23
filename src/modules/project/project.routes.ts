import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validateBody, validateParams, validateQuery } from '../../utils/validation';
import { createProjectController } from './project.controller';
import {
  createProjectBodySchema,
  createStageBodySchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  stageParamsSchema,
  updateProgressBodySchema,
  updateProjectBodySchema,
  updateStageBodySchema,
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
    '/:id',
    requireRole('admin'),
    validateParams(projectIdParamsSchema),
    validateBody(updateProjectBodySchema),
    controller.update,
  );
  router.delete(
    '/:id',
    requireRole('admin'),
    validateParams(projectIdParamsSchema),
    controller.remove,
  );
  router.put(
    '/:id/progress',
    requireRole('admin', 'field_staff'),
    validateParams(projectIdParamsSchema),
    validateBody(updateProgressBodySchema),
    controller.updateProgress,
  );

  // Custom workflow: stages belong to the project, not to a global template.
  router.get('/:id/stages', validateParams(projectIdParamsSchema), controller.listStages);
  router.post(
    '/:id/stages',
    requireRole('admin'),
    validateParams(projectIdParamsSchema),
    validateBody(createStageBodySchema),
    controller.createStage,
  );
  router.put(
    '/:id/stages/:stageId',
    requireRole('admin', 'field_staff'),
    validateParams(stageParamsSchema),
    validateBody(updateStageBodySchema),
    controller.updateStage,
  );
  router.delete(
    '/:id/stages/:stageId',
    requireRole('admin'),
    validateParams(stageParamsSchema),
    controller.deleteStage,
  );

  return router;
}
