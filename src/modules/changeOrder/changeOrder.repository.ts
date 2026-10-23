import type { Queryable } from '../../config/database';
import type { ChangeOrderStatus } from '../../types/domain';

export interface ChangeOrderRow {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  description: string | null;
  cost_impact: string | number;
  status: ChangeOrderStatus;
  signed_by: string | null;
  signed_at: Date | string | null;
  ip_address: string | null;
  created_at: Date | string;
}

const PLAIN_COLUMNS = `
  id, tenant_id, project_id, title, description, cost_impact, status,
  signed_by, signed_at, ip_address, created_at
`;

const JOINED_COLUMNS = `
  co.id, co.tenant_id, co.project_id, co.title, co.description, co.cost_impact, co.status,
  co.signed_by, co.signed_at, co.ip_address, co.created_at
`;

export interface ChangeOrderFilters {
  clientId: string | null;
  projectId?: string;
  status?: ChangeOrderStatus;
  limit: number;
}

/**
 * Client-role listing joins projects and filters on the verified client id, so
 * an order on someone else's project can never appear in the result set.
 */
export async function listChangeOrders(
  db: Queryable,
  tenantId: string,
  filters: ChangeOrderFilters,
): Promise<ChangeOrderRow[]> {
  const params: unknown[] = [tenantId];
  let sql: string;

  if (filters.clientId) {
    sql = `SELECT ${JOINED_COLUMNS}
             FROM change_orders co
             JOIN projects p ON p.id = co.project_id AND p.tenant_id = co.tenant_id
            WHERE co.tenant_id = $1 AND p.client_id = $2`;
    params.push(filters.clientId);
  } else {
    sql = `SELECT ${PLAIN_COLUMNS} FROM change_orders WHERE tenant_id = $1`;
  }

  if (filters.projectId) {
    params.push(filters.projectId);
    sql += ` AND ${filters.clientId ? 'co.' : ''}project_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND ${filters.clientId ? 'co.' : ''}status = $${params.length}`;
  }

  sql += ` ORDER BY ${filters.clientId ? 'co.' : ''}created_at DESC`;
  params.push(filters.limit);
  sql += ` LIMIT $${params.length}`;

  const { rows } = await db.query<ChangeOrderRow>(sql, params);
  return rows;
}

export async function findChangeOrderById(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
): Promise<ChangeOrderRow | null> {
  const { rows } = await db.query<ChangeOrderRow>(
    `SELECT ${PLAIN_COLUMNS} FROM change_orders
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, changeOrderId],
  );
  return rows[0] ?? null;
}

export async function findChangeOrderForClient(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
  clientId: string,
): Promise<ChangeOrderRow | null> {
  const { rows } = await db.query<ChangeOrderRow>(
    `SELECT ${JOINED_COLUMNS}
       FROM change_orders co
       JOIN projects p ON p.id = co.project_id AND p.tenant_id = co.tenant_id
      WHERE co.tenant_id = $1 AND co.id = $2 AND p.client_id = $3
      LIMIT 1`,
    [tenantId, changeOrderId, clientId],
  );
  return rows[0] ?? null;
}

export interface ChangeOrderInsert {
  projectId: string;
  title: string;
  description: string | null;
  costImpact: number;
}

export async function insertChangeOrder(
  db: Queryable,
  tenantId: string,
  input: ChangeOrderInsert,
): Promise<ChangeOrderRow> {
  const { rows } = await db.query<ChangeOrderRow>(
    `INSERT INTO change_orders (tenant_id, project_id, title, description, cost_impact)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PLAIN_COLUMNS}`,
    [tenantId, input.projectId, input.title, input.description, input.costImpact],
  );
  const row = rows[0];
  if (!row) throw new Error('Change order insert returned no row.');
  return row;
}

export async function approveChangeOrderRow(
  db: Queryable,
  params: {
    tenantId: string;
    changeOrderId: string;
    signedBy: string;
    signedAt: string;
    ipAddress: string | null;
  },
): Promise<ChangeOrderRow | null> {
  const { rows } = await db.query<ChangeOrderRow>(
    `UPDATE change_orders
        SET status = 'approved', signed_by = $3, signed_at = $4, ip_address = $5
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING ${PLAIN_COLUMNS}`,
    [params.tenantId, params.changeOrderId, params.signedBy, params.signedAt, params.ipAddress],
  );
  return rows[0] ?? null;
}

export async function rejectChangeOrderRow(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
): Promise<ChangeOrderRow | null> {
  const { rows } = await db.query<ChangeOrderRow>(
    `UPDATE change_orders
        SET status = 'rejected'
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING ${PLAIN_COLUMNS}`,
    [tenantId, changeOrderId],
  );
  return rows[0] ?? null;
}
