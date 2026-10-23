import type { Queryable } from '../../config/database';
import type { StageStatus } from './project.schemas';

export interface StageRow {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  position: number;
  status: StageStatus;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const STAGE_COLUMNS = `
  id, tenant_id, project_id, name, position, status, completed_at, created_at, updated_at
`;

export async function listStages(
  db: Queryable,
  tenantId: string,
  projectId: string,
): Promise<StageRow[]> {
  const { rows } = await db.query<StageRow>(
    `SELECT ${STAGE_COLUMNS}
       FROM project_stages
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY position ASC, created_at ASC`,
    [tenantId, projectId],
  );
  return rows;
}

export async function findStageById(
  db: Queryable,
  tenantId: string,
  projectId: string,
  stageId: string,
): Promise<StageRow | null> {
  const { rows } = await db.query<StageRow>(
    `SELECT ${STAGE_COLUMNS}
       FROM project_stages
      WHERE tenant_id = $1 AND project_id = $2 AND id = $3
      LIMIT 1`,
    [tenantId, projectId, stageId],
  );
  return rows[0] ?? null;
}

export async function nextStagePosition(
  db: Queryable,
  tenantId: string,
  projectId: string,
): Promise<number> {
  const { rows } = await db.query<{ max: number | string | null }>(
    `SELECT MAX(position) AS max
       FROM project_stages
      WHERE tenant_id = $1 AND project_id = $2`,
    [tenantId, projectId],
  );
  const value = rows[0]?.max;
  return value === null || value === undefined ? 0 : Number(value) + 1;
}

export interface StageInsert {
  name: string;
  position: number;
  status: StageStatus;
}

export async function insertStage(
  db: Queryable,
  tenantId: string,
  projectId: string,
  input: StageInsert,
): Promise<StageRow> {
  const { rows } = await db.query<StageRow>(
    `INSERT INTO project_stages (tenant_id, project_id, name, position, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END)
     RETURNING ${STAGE_COLUMNS}`,
    [tenantId, projectId, input.name, input.position, input.status],
  );
  const row = rows[0];
  if (!row) throw new Error('Stage insert returned no row.');
  return row;
}

export interface StageUpdate {
  name?: string;
  position?: number;
  status?: StageStatus;
}

export async function updateStageRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
  stageId: string,
  update: StageUpdate,
): Promise<StageRow | null> {
  const assignments: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];

  if (update.name !== undefined) {
    values.push(update.name);
    assignments.push(`name = $${values.length}`);
  }
  if (update.position !== undefined) {
    values.push(update.position);
    assignments.push(`position = $${values.length}`);
  }
  if (update.status !== undefined) {
    values.push(update.status);
    assignments.push(`status = $${values.length}`);
    assignments.push(`completed_at = CASE WHEN $${values.length} = 'completed' THEN NOW() ELSE NULL END`);
  }

  values.push(tenantId, projectId, stageId);
  const { rows } = await db.query<{ id: string }>(
    `UPDATE project_stages
        SET ${assignments.join(', ')}
      WHERE tenant_id = $${values.length - 2}
        AND project_id = $${values.length - 1}
        AND id = $${values.length}
      RETURNING id`,
    values,
  );
  if (!rows[0]) return null;
  return findStageById(db, tenantId, projectId, stageId);
}

export async function deleteStageRow(
  db: Queryable,
  tenantId: string,
  projectId: string,
  stageId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM project_stages
      WHERE tenant_id = $1 AND project_id = $2 AND id = $3`,
    [tenantId, projectId, stageId],
  );
  return (rowCount ?? 0) > 0;
}
