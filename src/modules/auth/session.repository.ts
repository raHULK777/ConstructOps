import type { Queryable } from '../../config/database';
import type { UserRole } from '../../types/domain';

export interface AuthSessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  replaced_by: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date | string;
  last_used_at: Date | string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

const SESSION_COLUMNS = `
  id, tenant_id, user_id, refresh_token_hash, replaced_by, user_agent,
  ip_address, created_at, last_used_at, expires_at, revoked_at
`;

export interface SessionInsert {
  id: string;
  tenantId: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
}

export async function insertSession(
  db: Queryable,
  input: SessionInsert,
): Promise<AuthSessionRow> {
  const { rows } = await db.query<AuthSessionRow>(
    `INSERT INTO auth_sessions
       (id, tenant_id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING ${SESSION_COLUMNS}`,
    [
      input.id,
      input.tenantId,
      input.userId,
      input.refreshTokenHash,
      input.userAgent,
      input.ipAddress,
      input.expiresAt,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('Session insert returned no row.');
  return row;
}

export async function findSessionByHash(
  db: Queryable,
  tenantId: string,
  refreshTokenHash: string,
): Promise<AuthSessionRow | null> {
  const { rows } = await db.query<AuthSessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM auth_sessions
      WHERE tenant_id = $1 AND refresh_token_hash = $2
      LIMIT 1`,
    [tenantId, refreshTokenHash],
  );
  return rows[0] ?? null;
}

/** Atomically revokes an active session; returns false if it was already used. */
export async function revokeSession(
  db: Queryable,
  sessionId: string,
  replacedBy: string | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE auth_sessions
        SET revoked_at = NOW(), last_used_at = NOW(), replaced_by = $2
      WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, replacedBy],
  );
  return (rowCount ?? 0) > 0;
}

/** Revokes every active session for a user (refresh-token reuse response). */
export async function revokeAllSessions(
  db: Queryable,
  tenantId: string,
  userId: string,
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE auth_sessions
        SET revoked_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tenantId, userId],
  );
  return rowCount ?? 0;
}

export async function revokeByHash(
  db: Queryable,
  tenantId: string,
  refreshTokenHash: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE auth_sessions
        SET revoked_at = NOW(), last_used_at = NOW()
      WHERE tenant_id = $1 AND refresh_token_hash = $2 AND revoked_at IS NULL`,
    [tenantId, refreshTokenHash],
  );
  return (rowCount ?? 0) > 0;
}

export interface SessionUserRow {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Validates that the access token's session is still active and returns the
 * current user record. This is what makes logout revocation immediate rather
 * than "at token expiry".
 */
export async function findUserForSession(
  db: Queryable,
  tenantId: string,
  userId: string,
  sessionId: string,
): Promise<SessionUserRow | null> {
  const { rows } = await db.query<SessionUserRow>(
    `SELECT u.id, u.email, u.role
       FROM users u
       JOIN auth_sessions s
         ON s.user_id = u.id AND s.tenant_id = u.tenant_id
      WHERE u.tenant_id = $1
        AND u.id = $2
        AND s.id = $3
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1`,
    [tenantId, userId, sessionId],
  );
  return rows[0] ?? null;
}
