import type { Queryable } from '../../config/database';

export interface PasswordResetRow {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  used_at: Date | string | null;
}

const RESET_COLUMNS = `
  id, tenant_id, user_id, token_hash, created_at, expires_at, used_at
`;

export async function insertPasswordReset(
  db: Queryable,
  input: { id: string; tenantId: string; userId: string; tokenHash: string; expiresAt: string },
): Promise<void> {
  await db.query(
    `INSERT INTO password_reset_tokens (id, tenant_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.id, input.tenantId, input.userId, input.tokenHash, input.expiresAt],
  );
}

export async function findPasswordResetByHash(
  db: Queryable,
  tenantId: string,
  tokenHash: string,
): Promise<PasswordResetRow | null> {
  const { rows } = await db.query<PasswordResetRow>(
    `SELECT ${RESET_COLUMNS}
       FROM password_reset_tokens
      WHERE tenant_id = $1 AND token_hash = $2
      LIMIT 1`,
    [tenantId, tokenHash],
  );
  return rows[0] ?? null;
}

export async function markPasswordResetUsed(
  db: Queryable,
  resetId: string,
): Promise<void> {
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
    [resetId],
  );
}

/** Invalidates every outstanding reset token for a user (after a successful reset). */
export async function invalidatePasswordResetsForUser(
  db: Queryable,
  tenantId: string,
  userId: string,
): Promise<void> {
  await db.query(
    `UPDATE password_reset_tokens
        SET used_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND used_at IS NULL`,
    [tenantId, userId],
  );
}

export async function updateUserPassword(
  db: Queryable,
  tenantId: string,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.query(
    `UPDATE users SET password_hash = $3 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, userId, passwordHash],
  );
}
