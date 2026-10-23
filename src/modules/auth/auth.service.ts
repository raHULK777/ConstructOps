import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { unauthorized } from '../../utils/errors';
import { signAccessToken } from '../../utils/jwt';
import { verifyAgainstDummyHash, verifyPassword } from '../../utils/password';
import { toLoginBranding, type LoginTenantBranding } from '../tenant/tenant.mapper';
import { findUserByEmail } from './auth.repository';
import type { LoginBody } from './auth.schemas';

export interface LoginResult {
  token: string;
  user: Pick<AuthUser, 'id' | 'email' | 'role'>;
  tenantBranding: LoginTenantBranding;
}

export async function login(
  deps: AppDependencies,
  tenant: TenantRecord,
  input: LoginBody,
): Promise<LoginResult> {
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

  deps.logger.info('Login succeeded', {
    tenantId: tenant.id,
    userId: user.id,
    role: user.role,
  });

  return {
    token: signAccessToken(user, deps.env),
    user: { id: user.id, email: user.email, role: user.role },
    tenantBranding: toLoginBranding(tenant),
  };
}
