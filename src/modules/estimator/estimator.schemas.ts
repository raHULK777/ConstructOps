import { z } from 'zod';

export const estimateBodySchema = z.strictObject({
  squareFootage: z.number().int().positive().max(1_000_000),
  materialTier: z.string().trim().min(1).max(60),
  projectType: z.string().trim().min(1).max(60),
});

export type EstimateBody = z.infer<typeof estimateBodySchema>;
