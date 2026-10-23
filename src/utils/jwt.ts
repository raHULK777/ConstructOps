import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { Env } from '../config/env';
import { USER_ROLES, type AuthUser, type UserRole } from '../types/domain';
import { unauthorized } from './errors';
import { isUuidV4 } from './uuid';

export interface AccessTokenClaims {
  sub: string;
  tenant_id: string;
  role: UserRole;
  email: string;
  /** Server-side session id; revocation is checked against it on every request. */
  sid: string;
  iat: number;
  exp: number;
}

export function signAccessToken(user: AuthUser, sessionId: string, env: Env): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    subject: user.id,
    jwtid: randomUUID(),
    // JWT_EXPIRES_IN is validated as a short string; ms parses "15m", "1h", ...
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(
    {
      tenant_id: user.tenant_id,
      role: user.role,
      email: user.email,
      sid: sessionId,
    },
    env.jwtSecret,
    options,
  );
}

export function verifyAccessToken(token: string, env: Env): AccessTokenClaims {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      clockTolerance: 5,
    });
  } catch {
    throw unauthorized();
  }

  if (typeof decoded === 'string') throw unauthorized();

  const claims = decoded as JwtPayload & Record<string, unknown>;
  const { sub, tenant_id: tenantId, role, email, sid } = claims;

  if (typeof sub !== 'string' || !isUuidV4(sub)) throw unauthorized();
  if (typeof tenantId !== 'string' || !isUuidV4(tenantId)) throw unauthorized();
  if (typeof sid !== 'string' || !isUuidV4(sid)) throw unauthorized();
  if (typeof role !== 'string' || !USER_ROLES.includes(role as UserRole)) throw unauthorized();
  if (typeof email !== 'string' || email.length === 0) throw unauthorized();

  return {
    sub,
    tenant_id: tenantId,
    role: role as UserRole,
    email,
    sid,
    iat: typeof claims.iat === 'number' ? claims.iat : 0,
    exp: typeof claims.exp === 'number' ? claims.exp : 0,
  };
}

/** Reads the expiry of a freshly signed token (no re-verification needed). */
export function accessTokenExpiresAt(token: string): string {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
    return new Date(decoded.exp * 1000).toISOString();
  }
  return new Date().toISOString();
}
