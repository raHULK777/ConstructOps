import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant } from '../../utils/context';
import { validatedBody } from '../../utils/validation';
import type { EstimateBody } from './estimator.schemas';
import { calculateEstimate } from './estimator.service';

export function createEstimatorController(_deps: AppDependencies) {
  return {
    estimate: asyncHandler((req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<EstimateBody>(req);
      const calculation = calculateEstimate(tenant, body);
      res.status(200).json({ success: true, calculation });
    }),
  };
}
