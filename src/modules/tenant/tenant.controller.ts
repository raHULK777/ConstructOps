import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant } from '../../utils/context';
import { normalizeHost } from '../../utils/host';
import { validatedBody } from '../../utils/validation';
import { toPublicBranding } from './tenant.mapper';
import type { UpdateBrandingBody } from './tenant.schemas';
import { updateTenantBranding } from './tenant.service';

export function createTenantController(deps: AppDependencies) {
  return {
    getBranding: asyncHandler((req: Request, res: Response) => {
      const tenant = requireTenant(req);
      res.status(200).json({ success: true, tenant: toPublicBranding(tenant) });
    }),

    updateBranding: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const patch = validatedBody<UpdateBrandingBody>(req);
      const updated = await updateTenantBranding(deps, {
        tenant,
        host: normalizeHost(req.headers.host),
        patch,
      });
      res.status(200).json({ success: true, tenant: toPublicBranding(updated) });
    }),
  };
}
