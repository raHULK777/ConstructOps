import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { unauthorized } from '../../utils/errors';
import { accessTokenExpiresAt, signAccessToken } from '../../utils/jwt';
import { verifyAgainstDummyHash, verifyPassword } from '../../utils/password';
import { toLoginBranding, type LoginTenantBranding } from '../tenant/tenant.mapper';
import { findUserByEmail, findUserById } from './auth.repository';
import type { LoginBody } from './auth.schemas';
import { createSession, revokeSessionByToken, rotateSession } from './session.service';

export interface AuthResult {
  token: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: Pick<AuthUser, 'id' | 'email' | 'role'>;
  tenantBranding: LoginTenantBranding;
}

export interface AuthContext {
  userAgent: string | null;
  ipAddress: string | null;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

export async function login(
  deps: AppDependencies,
  tenant: TenantRecord,
  input: LoginBody,
  context: AuthContext,
): Promise<AuthResult> {
  const row = await findUserByEmail(deps.db, tenant.id, input.email);

  if (!row) {
    // Same CPU cost as a real comparison: email existence must not be inferable.
    await verifyAgainstDummyHash(input.password);
    throw unauthorized('Invalid email or password.');
  }

  const valid = await verifyPassword(input.password, row.password_hash);
  if (!valid) {
    throw unauthorized('Invalid email or password.');
  }

  const user: AuthUser = {
    id: row.id,
    tenant_id: tenant.id,
    email: row.email,
    role: row.role,
  };

  const { session, refreshToken } = await createSession(deps, {
    tenantId: tenant.id,
    userId: user.id,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  const token = signAccessToken(user, session.id, deps.env);

  deps.logger.info('Login succeeded', {
    tenantId: tenant.id,
    userId: user.id,
    role: user.role,
    sessionId: session.id,
  });

  return {
    token,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt(token),
    refreshTokenExpiresAt: toIso(session.expires_at),
    user: { id: user.id, email: user.email, role: user.role },
    tenantBranding: toLoginBranding(tenant),
  };
}

export async function refresh(
  deps: AppDependencies,
  tenant: TenantRecord,
  refreshToken: string,
  context: AuthContext,
): Promise<AuthResult> {
  const rotated = await rotateSession(deps, tenant, refreshToken, context);
  const userRow = await findUserById(deps.db, tenant.id, rotated.session.user_id);

  if (!userRow) {
    throw unauthorized('Invalid or expired refresh token.');
  }

  const token = signAccessToken(
    { id: userRow.id, tenant_id: tenant.id, email: userRow.email, role: userRow.role },
    rotated.session.id,
    deps.env,
  );

  return {
    token,
    refreshToken: rotated.refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt(token),
    refreshTokenExpiresAt: toIso(rotated.session.expires_at),
    user: { id: userRow.id, email: userRow.email, role: userRow.role },
    tenantBranding: toLoginBranding(tenant),
  };
}

export async function logout(
  deps: AppDependencies,
  tenant: TenantRecord,
  refreshToken: string,
): Promise<void> {
  const revoked = await revokeSessionByToken(deps, tenant, refreshToken);
  // Always report success: a caller must not be able to distinguish an unknown
  // token from one that was valid, and logout is idempotent.
  deps.logger.info('Logout processed', { tenantId: tenant.id, revoked });
}
