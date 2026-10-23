import { z } from 'zod';
import { PROJECT_STATUSES } from '../../types/domain';
import { UUID_V4_REGEX } from '../../utils/uuid';

const uuid = (field: string) =>
  z.string().regex(UUID_V4_REGEX, `${field} must be a valid UUIDv4`);

export const projectIdParamsSchema = z.strictObject({ id: uuid('id') });

export const listProjectsQuerySchema = z.strictObject({
  status: z.enum(PROJECT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateProgressBodySchema = z.strictObject({
  currentPhase: z.string().trim().min(1).max(100),
  progressPercentage: z.number().int().min(0).max(100),
});

export const createProjectBodySchema = z.strictObject({
  projectName: z.string().trim().min(2).max(255),
  clientId: uuid('clientId').optional(),
  status: z.enum(PROJECT_STATUSES).default('planning'),
  currentPhase: z.string().trim().min(1).max(100).default('Permitting'),
  progressPercentage: z.number().int().min(0).max(100).default(0),
  estimatedCost: z.number().min(0).max(9_999_999_999.99).default(0),
});

export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type UpdateProgressBody = z.infer<typeof updateProgressBodySchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
