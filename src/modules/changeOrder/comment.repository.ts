import type { Queryable } from '../../config/database';
import type { UserRole } from '../../types/domain';

export interface CommentRow {
  id: string;
  tenant_id: string;
  change_order_id: string;
  author_id: string;
  body: string;
  created_at: Date | string;
  first_name: string | null;
  last_name: string | null;
  author_email: string;
  author_role: UserRole;
}

const COMMENT_SELECT = `
  SELECT c.id, c.tenant_id, c.change_order_id, c.author_id, c.body, c.created_at,
         u.first_name, u.last_name, u.email AS author_email, u.role AS author_role
    FROM change_order_comments c
    JOIN users u ON u.id = c.author_id AND u.tenant_id = c.tenant_id
`;

export async function listComments(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
): Promise<CommentRow[]> {
  const { rows } = await db.query<CommentRow>(
    `${COMMENT_SELECT}
      WHERE c.tenant_id = $1 AND c.change_order_id = $2
      ORDER BY c.created_at ASC`,
    [tenantId, changeOrderId],
  );
  return rows;
}

export async function insertComment(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
  authorId: string,
  body: string,
): Promise<CommentRow> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO change_order_comments (tenant_id, change_order_id, author_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, changeOrderId, authorId, body],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Comment insert returned no row.');

  const created = await db.query<CommentRow>(
    `${COMMENT_SELECT} WHERE c.tenant_id = $1 AND c.id = $2 LIMIT 1`,
    [tenantId, id],
  );
  const row = created.rows[0];
  if (!row) throw new Error('Comment disappeared after insert.');
  return row;
}
