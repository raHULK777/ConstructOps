import type { RequestHandler } from 'express';
import type { Db } from '../config/database';
import type { Env } from '../config/env';
import { findUserForSession } from '../modules/auth/session.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { requireTenant } from '../utils/context';
import { tenantScopeMismatch, unauthorized } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticateDeps {
  db: Db;
  env: Env;
}

/**
 * Three sequential guarantees, all mandatory (Security-policy.md, sections 3-5):
 *   1. a syntactically valid, correctly signed, unexpired HS256 token;
 *   2. a token tenant claim equal to the tenant resolved from the request host;
 *   3. a live server-side session and an existing user in *that* tenant, whose
 *      current role is authoritative over the (possibly stale) claim.
 *
 * Step 3 is what makes logout revoke access immediately: the session row is
 * checked on every request, not just when the refresh token is exchanged.
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

    const user = await findUserForSession(deps.db, tenant.id, claims.sub, claims.sid);
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
