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
}

export const PROJECT_COLUMNS = `
  id, tenant_id, client_id, project_name, status, current_phase,
  progress_percentage, estimated_cost, updated_at
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
  let sql = `SELECT ${PROJECT_COLUMNS} FROM projects WHERE tenant_id = $1`;

  if (filters.clientId) {
    params.push(filters.clientId);
    sql += ` AND client_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }

  sql += ' ORDER BY updated_at DESC, id DESC';
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
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
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
  const { rows } = await db.query<ProjectRow>(
    `INSERT INTO projects
       (tenant_id, client_id, project_name, status, current_phase, progress_percentage, estimated_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PROJECT_COLUMNS}`,
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
  const row = rows[0];
  if (!row) throw new Error('Project insert returned no row.');
  return row;
}

export async function updateProjectProgressRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
  update: { currentPhase: string; progressPercentage: number },
): Promise<ProjectRow | null> {
  const { rows } = await db.query<ProjectRow>(
    `UPDATE projects
        SET current_phase = $3, progress_percentage = $4, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING ${PROJECT_COLUMNS}`,
    [tenantId, projectId, update.currentPhase, update.progressPercentage],
  );
  return rows[0] ?? null;
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

export async function findClientUser(
  db: Queryable,
  tenantId: string,
  userId: string,
): Promise<{ id: string } | null> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE tenant_id = $1 AND id = $2 AND role = 'client' LIMIT 1`,
    [tenantId, userId],
  );
  return rows[0] ?? null;
}
