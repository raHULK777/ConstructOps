import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant, requireUser } from '../../utils/context';
import { clientIp } from '../../utils/ip';
import { validatedBody, validatedParams, validatedQuery } from '../../utils/validation';
import type {
  ChangeOrderIdParams,
  CreateChangeOrderBody,
  ListChangeOrdersQuery,
} from './changeOrder.schemas';
import {
  approveChangeOrder,
  createChangeOrder,
  getChangeOrderForUser,
  listChangeOrdersForUser,
  rejectChangeOrder,
} from './changeOrder.service';

export function createChangeOrderController(deps: AppDependencies) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const query = validatedQuery<ListChangeOrdersQuery>(req);
      const changeOrders = await listChangeOrdersForUser(deps, tenant, user, query);
      res.status(200).json({ success: true, changeOrders });
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const { id } = validatedParams<ChangeOrderIdParams>(req);
      const changeOrder = await getChangeOrderForUser(deps, tenant, user, id);
      res.status(200).json({ success: true, changeOrder });
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<CreateChangeOrderBody>(req);
      const changeOrder = await createChangeOrder(deps, tenant, body);
      res.status(201).json({ success: true, changeOrder });
    }),

    approve: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const { id } = validatedParams<ChangeOrderIdParams>(req);
      const result = await approveChangeOrder(deps, tenant, user, id, clientIp(req));
      res.status(200).json({ success: true, ...result });
    }),

    reject: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ChangeOrderIdParams>(req);
      const changeOrder = await rejectChangeOrder(deps, tenant, id);
      res.status(200).json({
        success: true,
        message: 'Change order rejected.',
        changeOrder,
      });
    }),
  };
}
