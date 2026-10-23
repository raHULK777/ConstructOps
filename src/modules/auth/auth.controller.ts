import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant } from '../../utils/context';
import { clientIp } from '../../utils/ip';
import { validatedBody } from '../../utils/validation';
import type { ForgotPasswordBody, LoginBody, RefreshBody, ResetPasswordBody } from './auth.schemas';
import { login, logout, refresh } from './auth.service';
import { requestPasswordReset, resetPassword } from './passwordReset.service';

export function createAuthController(deps: AppDependencies) {
  return {
    login: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<LoginBody>(req);
      const result = await login(deps, tenant, body, {
        userAgent: req.header('user-agent') ?? null,
        ipAddress: clientIp(req),
      });
      res.status(200).json({ success: true, ...result });
    }),

    refresh: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<RefreshBody>(req);
      const result = await refresh(deps, tenant, body.refreshToken, {
        userAgent: req.header('user-agent') ?? null,
        ipAddress: clientIp(req),
      });
      res.status(200).json({ success: true, ...result });
    }),

    logout: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<RefreshBody>(req);
      await logout(deps, tenant, body.refreshToken);
      res.status(200).json({ success: true });
    }),

    forgotPassword: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<ForgotPasswordBody>(req);
      await requestPasswordReset(deps, tenant, body.email);
      // Identical response whether or not the account exists.
      res.status(200).json({
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.',
      });
    }),

    resetPassword: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<ResetPasswordBody>(req);
      await resetPassword(deps, tenant, body.token, body.newPassword);
      res.status(200).json({
        success: true,
        message: 'Password updated. Sign in with your new password.',
      });
    }),
  };
}
