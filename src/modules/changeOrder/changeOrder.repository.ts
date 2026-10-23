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
  rejected_by: string | null;
  rejected_at: Date | string | null;
  created_at: Date | string;
  signed_by_first: string | null;
  signed_by_last: string | null;
  rejected_by_first: string | null;
  rejected_by_last: string | null;
}

const CHANGE_ORDER_SELECT = `
  SELECT co.id, co.tenant_id, co.project_id, co.title, co.description, co.cost_impact,
         co.status, co.signed_by, co.signed_at, co.ip_address, co.rejected_by,
         co.rejected_at, co.created_at,
         su.first_name AS signed_by_first, su.last_name AS signed_by_last,
         ru.first_name AS rejected_by_first, ru.last_name AS rejected_by_last
    FROM change_orders co
    LEFT JOIN users su ON su.id = co.signed_by AND su.tenant_id = co.tenant_id
    LEFT JOIN users ru ON ru.id = co.rejected_by AND ru.tenant_id = co.tenant_id
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
  let sql = CHANGE_ORDER_SELECT;
  let where: string;

  if (filters.clientId) {
    sql += ` JOIN projects p ON p.id = co.project_id AND p.tenant_id = co.tenant_id`;
    where = 'WHERE co.tenant_id = $1 AND p.client_id = $2';
    params.push(filters.clientId);
  } else {
    where = 'WHERE co.tenant_id = $1';
  }

  if (filters.projectId) {
    params.push(filters.projectId);
    where += ` AND co.project_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    where += ` AND co.status = $${params.length}`;
  }

  sql += ` ${where} ORDER BY co.created_at DESC`;
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
    `${CHANGE_ORDER_SELECT} WHERE co.tenant_id = $1 AND co.id = $2 LIMIT 1`,
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
    `${CHANGE_ORDER_SELECT}
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
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO change_orders (tenant_id, project_id, title, description, cost_impact)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, input.projectId, input.title, input.description, input.costImpact],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Change order insert returned no row.');

  const created = await findChangeOrderById(db, tenantId, id);
  if (!created) throw new Error('Change order disappeared after insert.');
  return created;
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
  const { rows } = await db.query<{ id: string }>(
    `UPDATE change_orders
        SET status = 'approved', signed_by = $3, signed_at = $4, ip_address = $5
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id`,
    [params.tenantId, params.changeOrderId, params.signedBy, params.signedAt, params.ipAddress],
  );
  if (!rows[0]) return null;
  return findChangeOrderById(db, params.tenantId, params.changeOrderId);
}

export async function rejectChangeOrderRow(
  db: Queryable,
  tenantId: string,
  changeOrderId: string,
  rejectedBy: string,
): Promise<ChangeOrderRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE change_orders
        SET status = 'rejected', rejected_by = $3, rejected_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      RETURNING id`,
    [tenantId, changeOrderId, rejectedBy],
  );
  if (!rows[0]) return null;
  return findChangeOrderById(db, tenantId, changeOrderId);
}
