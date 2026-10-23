import { Router } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { validateBody } from '../../utils/validation';
import { createTenantController } from './tenant.controller';
import { updateBrandingBodySchema } from './tenant.schemas';

export function createTenantRoutes(deps: AppDependencies): Router {
  const router = Router();
  const controller = createTenantController(deps);

  // Public: the white-label theme engine reads this before a session exists.
  router.get('/branding', controller.getBranding);

  // Tenant administrators may re-skin their own workspace, never another's.
  router.put(
    '/branding',
    authenticate(deps),
    requireRole('admin'),
    validateBody(updateBrandingBodySchema),
    controller.updateBranding,
  );

  return router;
}
