import { z } from 'zod';
import { CHANGE_ORDER_STATUSES } from '../../types/domain';
import { UUID_V4_REGEX } from '../../utils/uuid';

const uuid = (field: string) =>
  z.string().regex(UUID_V4_REGEX, `${field} must be a valid UUIDv4`);

export const changeOrderIdParamsSchema = z.strictObject({ id: uuid('id') });

export const listChangeOrdersQuerySchema = z.strictObject({
  projectId: uuid('projectId').optional(),
  status: z.enum(CHANGE_ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createChangeOrderBodySchema = z.strictObject({
  projectId: uuid('projectId'),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().max(5000).optional(),
  costImpact: z.number().min(0).max(9_999_999_999.99),
});

export type ChangeOrderIdParams = z.infer<typeof changeOrderIdParamsSchema>;
export type ListChangeOrdersQuery = z.infer<typeof listChangeOrdersQuerySchema>;
export type CreateChangeOrderBody = z.infer<typeof createChangeOrderBodySchema>;
