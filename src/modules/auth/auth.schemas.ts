import { z } from 'zod';

export const loginBodySchema = z.strictObject({
  email: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.email(),
  ),
  password: z.string().min(1).max(200),
});

export const refreshBodySchema = z.strictObject({
  refreshToken: z.string().min(20).max(512),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
