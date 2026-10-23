import type { Queryable } from '../../config/database';
import type { ProjectStatus } from '../../types/domain';

export interface ProjectRow {
  id: string;
  tenant_id: string;
  client_id: string | null;
  project_name: string;
  status: ProjectStatus;
  current_phase: string | null;
  progress_percentage: number;
  estimated_cost: string | number;
  updated_at: Date | string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
}

const PROJECT_SELECT = `
  SELECT p.id, p.tenant_id, p.client_id, p.project_name, p.status, p.current_phase,
         p.progress_percentage, p.estimated_cost, p.updated_at,
         c.first_name AS client_first_name,
         c.last_name AS client_last_name,
         c.email AS client_email,
         c.phone AS client_phone
    FROM projects p
    LEFT JOIN users c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
`;

export interface ProjectFilters {
  /** Non-null for client-role requests: the ownership predicate is mandatory. */
  clientId: string | null;
  status?: ProjectStatus;
  limit: number;
}

export async function listProjects(
  db: Queryable,
  tenantId: string,
  filters: ProjectFilters,
): Promise<ProjectRow[]> {
  const params: unknown[] = [tenantId];
  let sql = `${PROJECT_SELECT} WHERE p.tenant_id = $1`;

  if (filters.clientId) {
    params.push(filters.clientId);
    sql += ` AND p.client_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND p.status = $${params.length}`;
  }

  sql += ' ORDER BY p.updated_at DESC, p.id DESC';
  params.push(filters.limit);
  sql += ` LIMIT $${params.length}`;

  const { rows } = await db.query<ProjectRow>(sql, params);
  return rows;
}

export async function findProjectById(
  db: Queryable,
  tenantId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  const { rows } = await db.query<ProjectRow>(
    `${PROJECT_SELECT} WHERE p.tenant_id = $1 AND p.id = $2 LIMIT 1`,
    [tenantId, projectId],
  );
  return rows[0] ?? null;
}

export interface ProjectInsert {
  projectName: string;
  clientId: string | null;
  status: ProjectStatus;
  currentPhase: string;
  progressPercentage: number;
  estimatedCost: number;
}

export async function insertProject(
  db: Queryable,
  tenantId: string,
  input: ProjectInsert,
): Promise<ProjectRow> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO projects
       (tenant_id, client_id, project_name, status, current_phase, progress_percentage, estimated_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      tenantId,
      input.clientId,
      input.projectName,
      input.status,
      input.currentPhase,
      input.progressPercentage,
      input.estimatedCost,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Project insert returned no row.');

  const created = await findProjectById(db, tenantId, id);
  if (!created) throw new Error('Project disappeared after insert.');
  return created;
}

export interface ProjectUpdate {
  projectName?: string;
  status?: ProjectStatus;
  estimatedCost?: number;
  clientId?: string | null;
}

/** Column names come from a fixed map; values always travel as parameters. */
export async function updateProjectRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
  update: ProjectUpdate,
): Promise<ProjectRow | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const columns: Array<[keyof ProjectUpdate, string]> = [
    ['projectName', 'project_name'],
    ['status', 'status'],
    ['estimatedCost', 'estimated_cost'],
    ['clientId', 'client_id'],
  ];

  for (const [key, column] of columns) {
    const value = update[key];
    if (value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  if (assignments.length === 0) return findProjectById(db, tenantId, projectId);

  values.push(tenantId, projectId);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE projects
        SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $${values.length - 1} AND id = $${values.length}
      RETURNING id`,
    values,
  );

  if (!rows[0]) return null;
  return findProjectById(db, tenantId, projectId);
}

export async function updateProjectProgressRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
  update: { currentPhase: string; progressPercentage: number },
): Promise<ProjectRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `UPDATE projects
        SET current_phase = $3, progress_percentage = $4, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id`,
    [tenantId, projectId, update.currentPhase, update.progressPercentage],
  );
  if (!rows[0]) return null;
  return findProjectById(db, tenantId, projectId);
}

export async function deleteProjectRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM projects WHERE tenant_id = $1 AND id = $2',
    [tenantId, projectId],
  );
  return (rowCount ?? 0) > 0;
}

export interface ClientUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string;
}

export async function findClientUser(
  db: Queryable,
  tenantId: string,
  userId: string,
): Promise<ClientUserRow | null> {
  const { rows } = await db.query<ClientUserRow>(
    `SELECT id, email, first_name, last_name, phone, role
       FROM users
      WHERE tenant_id = $1 AND id = $2 AND role = 'client'
      LIMIT 1`,
    [tenantId, userId],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(
  db: Queryable,
  tenantId: string,
  email: string,
): Promise<ClientUserRow | null> {
  const { rows } = await db.query<ClientUserRow>(
    `SELECT id, email, first_name, last_name, phone, role
       FROM users
      WHERE tenant_id = $1 AND email = $2
      LIMIT 1`,
    [tenantId, email],
  );
  return rows[0] ?? null;
}

export interface ClientUserInsert {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export async function insertClientUser(
  db: Queryable,
  tenantId: string,
  input: ClientUserInsert,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name, phone)
     VALUES ($1, $2, $3, 'client', $4, $5, $6)
     RETURNING id`,
    [tenantId, input.email, input.passwordHash, input.firstName, input.lastName, input.phone],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('Client insert returned no row.');
  return id;
}
