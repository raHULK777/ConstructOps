import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AppDependencies } from '../../types/dependencies';
import type { TenantRecord } from '../../types/domain';
import { unauthorized } from '../../utils/errors';
import {
  findSessionByHash,
  insertSession,
  revokeAllSessions,
  revokeByHash,
  revokeSession,
  type AuthSessionRow,
} from './session.repository';

export interface IssuedSession {
  session: AuthSessionRow;
  refreshToken: string;
}

export interface SessionContext {
  userAgent: string | null;
  ipAddress: string | null;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
  // 256 bits of entropy, URL-safe. Only the hash is ever persisted.
  return randomBytes(32).toString('base64url');
}

function refreshExpiry(deps: AppDependencies): string {
  return new Date(
    Date.now() + deps.env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function truncate(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

export function createSession(
  deps: AppDependencies,
  params: { tenantId: string; userId: string } & SessionContext,
): Promise<IssuedSession> {
  const refreshToken = newRefreshToken();
  return insertSession(deps.db, {
    id: randomUUID(),
    tenantId: params.tenantId,
    userId: params.userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: truncate(params.userAgent, 255),
    ipAddress: params.ipAddress,
    expiresAt: refreshExpiry(deps),
  }).then((session) => ({ session, refreshToken }));
}

/**
 * Rotating refresh. A token may be exchanged exactly once. Presenting an
 * already-revoked token is treated as theft and revokes the whole session family
 * for that user (OWASP refresh-token rotation guidance).
 */
export async function rotateSession(
  deps: AppDependencies,
  tenant: TenantRecord,
  rawToken: string,
  context: SessionContext,
): Promise<IssuedSession> {
  const existing = await findSessionByHash(deps.db, tenant.id, hashRefreshToken(rawToken));

  if (!existing) {
    throw unauthorized('Invalid or expired refresh token.');
  }

  if (existing.revoked_at) {
    const revoked = await revokeAllSessions(deps.db, tenant.id, existing.user_id);
    deps.logger.warn('Refresh token reuse detected; all sessions revoked', {
      tenantId: tenant.id,
      userId: existing.user_id,
      revoked,
    });
    throw unauthorized('Invalid or expired refresh token.');
  }

  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    throw unauthorized('Invalid or expired refresh token.');
  }

  const nextId = randomUUID();
  const refreshToken = newRefreshToken();

  // Insert the successor first (replaced_by is a foreign key), then revoke the
  // presented token atomically. If another request won the race, roll back the
  // successor and revoke the family: this is a replay.
  const session = await insertSession(deps.db, {
    id: nextId,
    tenantId: tenant.id,
    userId: existing.user_id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: truncate(context.userAgent, 255),
    ipAddress: context.ipAddress,
    expiresAt: refreshExpiry(deps),
  });

  const revoked = await revokeSession(deps.db, existing.id, nextId);
  if (!revoked) {
    await revokeAllSessions(deps.db, tenant.id, existing.user_id);
    throw unauthorized('Invalid or expired refresh token.');
  }

  return { session, refreshToken };
}

export async function revokeSessionByToken(
  deps: AppDependencies,
  tenant: TenantRecord,
  rawToken: string,
): Promise<boolean> {
  return revokeByHash(deps.db, tenant.id, hashRefreshToken(rawToken));
}
