import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { authenticate } from '../../middleware/authenticate';
import { requireFeature } from '../../middleware/requireFeature';
import { requireRole } from '../../middleware/requireRole';
import { validateBody, validateParams, validateQuery } from '../../utils/validation';
import { createChangeOrderController } from './changeOrder.controller';
import {
  changeOrderIdParamsSchema,
  createChangeOrderBodySchema,
  listChangeOrdersQuerySchema,
} from './changeOrder.schemas';

export function createChangeOrderRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createChangeOrderController(deps);

  router.use(authenticate(deps));
  // Whole module is premium-gated; the flag comes from the resolved tenant.
  router.use(requireFeature('enable_change_orders'));

  router.get('/', validateQuery(listChangeOrdersQuerySchema), controller.list);
  router.post(
    '/',
    requireRole('admin', 'field_staff'),
    validateBody(createChangeOrderBodySchema),
    controller.create,
  );
  router.get('/:id', validateParams(changeOrderIdParamsSchema), controller.get);

  // Legal signature: strictly the client role, on their own project only.
  router.put(
    '/:id/approve',
    requireRole('client'),
    validateParams(changeOrderIdParamsSchema),
    controller.approve,
  );
  router.put(
    '/:id/reject',
    requireRole('admin'),
    validateParams(changeOrderIdParamsSchema),
    controller.reject,
  );

  return router;
}
