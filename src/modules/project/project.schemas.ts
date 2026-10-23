import { z } from 'zod';
import { PROJECT_STATUSES } from '../../types/domain';
import { UUID_V4_REGEX } from '../../utils/uuid';

const uuid = (field: string) =>
  z.string().regex(UUID_V4_REGEX, `${field} must be a valid UUIDv4`);

export const projectIdParamsSchema = z.strictObject({ id: uuid('id') });

export const stageParamsSchema = z.strictObject({
  id: uuid('id'),
  stageId: uuid('stageId'),
});

export const listProjectsQuerySchema = z.strictObject({
  status: z.enum(PROJECT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateProgressBodySchema = z.strictObject({
  currentPhase: z.string().trim().min(1).max(100),
  progressPercentage: z.number().int().min(0).max(100),
});

export const customerSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  /** Required only when the email does not already belong to a client. */
  password: z.string().min(10).max(200).optional(),
});

export const createProjectBodySchema = z
  .strictObject({
    projectName: z.string().trim().min(2).max(255),
    clientId: uuid('clientId').optional(),
    customer: customerSchema.optional(),
    stages: z.array(z.string().trim().min(1).max(120)).min(1).max(20).optional(),
    status: z.enum(PROJECT_STATUSES).default('planning'),
    currentPhase: z.string().trim().min(1).max(100).default('Permitting'),
    progressPercentage: z.number().int().min(0).max(100).default(0),
    estimatedCost: z.number().min(0).max(9_999_999_999.99).default(0),
  })
  .refine((value) => !(value.clientId && value.customer), {
    message: 'Provide either clientId or customer, not both.',
  });

export const updateProjectBodySchema = z
  .strictObject({
    projectName: z.string().trim().min(2).max(255).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    estimatedCost: z.number().min(0).max(9_999_999_999.99).optional(),
    clientId: uuid('clientId').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one project field must be provided.',
  });

export const stageStatusSchema = z.enum(['pending', 'in_progress', 'completed']);

export const createStageBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  position: z.number().int().min(0).max(1000).optional(),
});

export const updateStageBodySchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    status: stageStatusSchema.optional(),
    position: z.number().int().min(0).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one stage field must be provided.',
  });

export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;
export type StageParams = z.infer<typeof stageParamsSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type UpdateProgressBody = z.infer<typeof updateProgressBodySchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type CreateStageBody = z.infer<typeof createStageBodySchema>;
export type UpdateStageBody = z.infer<typeof updateStageBodySchema>;
export type StageStatus = z.infer<typeof stageStatusSchema>;
