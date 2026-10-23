import type { Queryable } from '../../config/database';
import type { UserRole } from '../../types/domain';

export interface AuthUserRow {
  id: string;
  email: string;
  role: UserRole;
  password_hash: string;
}

export interface SessionUserRow {
  id: string;
  email: string;
  role: UserRole;
}

export async function findUserByEmail(
  db: Queryable,
  tenantId: string,
  email: string,
): Promise<AuthUserRow | null> {
  const { rows } = await db.query<AuthUserRow>(
    `SELECT id, email, role, password_hash
       FROM users
      WHERE tenant_id = $1 AND email = $2
      LIMIT 1`,
    [tenantId, email],
  );
  return rows[0] ?? null;
}

export async function findUserById(
  db: Queryable,
  tenantId: string,
  userId: string,
): Promise<SessionUserRow | null> {
  const { rows } = await db.query<SessionUserRow>(
    `SELECT id, email, role
       FROM users
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1`,
    [tenantId, userId],
  );
  return rows[0] ?? null;
}
