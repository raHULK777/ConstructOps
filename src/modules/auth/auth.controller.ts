import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant } from '../../utils/context';
import { validatedBody } from '../../utils/validation';
import type { LoginBody } from './auth.schemas';
import { login } from './auth.service';

export function createAuthController(deps: AppDependencies) {
  return {
    login: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<LoginBody>(req);
      const result = await login(deps, tenant, body);
      res.status(200).json({ success: true, ...result });
    }),
  };
}
