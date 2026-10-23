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

const normalisedEmail = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email(),
);

export const forgotPasswordBodySchema = z.strictObject({
  email: normalisedEmail,
});

export const resetPasswordBodySchema = z.strictObject({
  token: z.string().min(20).max(512),
  newPassword: z.string().min(10).max(200),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
