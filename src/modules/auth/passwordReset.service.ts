import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppDependencies } from '../../types/dependencies';
import type { TenantRecord } from '../../types/domain';
import { badRequest } from '../../utils/errors';
import { hashPassword } from '../../utils/password';
import { findUserByEmail } from './auth.repository';
import {
  findPasswordResetByHash,
  insertPasswordReset,
  invalidatePasswordResetsForUser,
  markPasswordResetUsed,
  updateUserPassword,
} from './passwordReset.repository';
import { revokeAllSessions } from './session.repository';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Reset links point at the tenant's own portal host in production. Locally that
 * host is not resolvable, so the configured portal URL is used instead.
 */
function resetUrl(deps: AppDependencies, tenant: TenantRecord, token: string): string {
  const host =
    tenant.custom_domain ??
    (deps.env.platformRootDomain
      ? `${tenant.subdomain}.${deps.env.platformRootDomain}`
      : null);

  // In production links normally point at the tenant's own domain. An explicit
  // APP_PORTAL_URL overrides that (used by the local Docker demo, where tenant
  // test domains do not resolve).
  const useTenantHost = deps.env.isProduction && !deps.env.portalUrlExplicit;
  const base = useTenantHost && host ? `https://${host}` : deps.env.portalUrl;
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Always resolves successfully: the response must not reveal whether an email
 * exists on this tenant.
 */
export async function requestPasswordReset(
  deps: AppDependencies,
  tenant: TenantRecord,
  email: string,
): Promise<void> {
  const user = await findUserByEmail(deps.db, tenant.id, email);
  if (!user) {
    deps.logger.info('Password reset requested for unknown email', { tenantId: tenant.id });
    return;
  }

  const token = newToken();
  const expiresAt = new Date(
    Date.now() + deps.env.resetTokenTtlMinutes * 60 * 1000,
  ).toISOString();

  await insertPasswordReset(deps.db, {
    id: randomUUID(),
    tenantId: tenant.id,
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const link = resetUrl(deps, tenant, token);
  try {
    await deps.mailer.send({
      to: user.email,
      subject: `Reset your ${tenant.company_name} password`,
      text:
        `A password reset was requested for ${user.email}.\n\n` +
        `Set a new password here (expires in ${deps.env.resetTokenTtlMinutes} minutes):\n${link}\n\n` +
        'If you did not request this, you can ignore this message.',
    });
  } catch (error) {
    deps.logger.warn('Password reset email failed to send', {
      tenantId: tenant.id,
      userId: user.id,
      error: (error as Error).message,
    });
  }

  deps.logger.info('Password reset issued', { tenantId: tenant.id, userId: user.id });
}

export async function resetPassword(
  deps: AppDependencies,
  tenant: TenantRecord,
  token: string,
  newPassword: string,
): Promise<void> {
  const reset = await findPasswordResetByHash(deps.db, tenant.id, hashToken(token));

  if (!reset || reset.used_at !== null || new Date(reset.expires_at).getTime() <= Date.now()) {
    throw badRequest('This reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(newPassword, deps.env.bcryptRounds);

  await updateUserPassword(deps.db, tenant.id, reset.user_id, passwordHash);
  await markPasswordResetUsed(deps.db, reset.id);
  await invalidatePasswordResetsForUser(deps.db, tenant.id, reset.user_id);
  // A password change invalidates every existing session for that user.
  await revokeAllSessions(deps.db, tenant.id, reset.user_id);

  deps.logger.info('Password reset completed', {
    tenantId: tenant.id,
    userId: reset.user_id,
  });
}
