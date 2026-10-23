import type { RequestHandler } from 'express';
import type { Db } from '../config/database';
import type { Env } from '../config/env';
import { findUserById } from '../modules/auth/auth.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { requireTenant } from '../utils/context';
import { tenantScopeMismatch, unauthorized } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticateDeps {
  db: Db;
  env: Env;
}

/**
 * Three sequential guarantees, all mandatory (Security-policy.md, section 3-5):
 *   1. a syntactically valid, correctly signed, unexpired HS256 token;
 *   2. a token tenant claim equal to the tenant resolved from the request host;
 *   3. a user that still exists in *that* tenant, whose current role is
 *      authoritative over the (possibly stale) role claim in the token.
 */
export function authenticate(deps: AuthenticateDeps): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized();
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw unauthorized();

    const claims = verifyAccessToken(token, deps.env);
    const tenant = requireTenant(req);

    if (claims.tenant_id !== tenant.id) {
      throw tenantScopeMismatch();
    }

    const user = await findUserById(deps.db, tenant.id, claims.sub);
    if (!user) {
      throw unauthorized();
    }

    req.user = {
      id: user.id,
      tenant_id: tenant.id,
      email: user.email,
      role: user.role,
    };

    next();
  });
}
