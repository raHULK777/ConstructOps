import type { Queryable } from '../../config/database';
import type { AppDependencies } from '../../types/dependencies';
import type { AuthUser, TenantRecord } from '../../types/domain';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { findProjectById } from './project.repository';
import {
  deleteStageRow,
  findStageById,
  insertStage,
  listStages,
  nextStagePosition,
  updateStageRow,
  type StageRow,
} from './stage.repository';
import type { CreateStageBody, StageStatus, UpdateStageBody } from './project.schemas';

export interface StageDto {
  id: string;
  projectId: string;
  name: string;
  position: number;
  status: StageStatus;
  completedAt: string | null;
}

function toStageDto(row: StageRow): StageDto {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    position: row.position,
    status: row.status,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

async function projectExists(
  db: Queryable,
  tenantId: string,
  projectId: string,
  user?: AuthUser,
): Promise<boolean> {
  const project = await findProjectById(db, tenantId, projectId);
  if (!project) return false;
  if (user?.role === 'client' && project.client_id !== user.id) return false;
  return true;
}

/**
 * Stage state is the source of truth for the project's headline progress:
 * completing a stage recomputes `progress_percentage` and moves `current_phase`.
 */
export async function recomputeProjectProgress(
  deps: AppDependencies,
  tenantId: string,
  projectId: string,
): Promise<void> {
  const stages = await listStages(deps.db, tenantId, projectId);
  if (stages.length === 0) return;

  const completed = stages.filter((stage) => stage.status === 'completed').length;
  const progress = Math.min(100, Math.max(0, Math.round((completed / stages.length) * 100)));
  const current =
    stages.find((stage) => stage.status === 'in_progress') ??
    stages.find((stage) => stage.status !== 'completed');
  const phase = current ? current.name : 'Completed';

  await deps.db.query(
    `UPDATE projects
        SET current_phase = $3, progress_percentage = $4, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2`,
    [tenantId, projectId, phase, progress],
  );
}

export async function listStagesForUser(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  projectId: string,
): Promise<StageDto[]> {
  if (!(await projectExists(deps.db, tenant.id, projectId, user))) {
    throw notFound();
  }
  const rows = await listStages(deps.db, tenant.id, projectId);
  return rows.map(toStageDto);
}

export async function createStage(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
  body: CreateStageBody,
): Promise<StageDto> {
  if (!(await projectExists(deps.db, tenant.id, projectId))) {
    throw notFound();
  }

  const position = body.position ?? (await nextStagePosition(deps.db, tenant.id, projectId));
  const stage = await insertStage(deps.db, tenant.id, projectId, {
    name: body.name,
    position,
    status: 'pending',
  });

  await recomputeProjectProgress(deps, tenant.id, projectId);
  deps.logger.info('Project stage created', { tenantId: tenant.id, projectId, stageId: stage.id });
  return toStageDto(stage);
}

export async function updateStage(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  projectId: string,
  stageId: string,
  body: UpdateStageBody,
): Promise<StageDto> {
  if (!(await projectExists(deps.db, tenant.id, projectId))) {
    throw notFound();
  }

  if (user.role === 'field_staff' && (body.name !== undefined || body.position !== undefined)) {
    throw forbidden('Field staff may only update stage status.');
  }

  const updated = await updateStageRow(deps.db, tenant.id, projectId, stageId, body);
  if (!updated) throw notFound();

  await recomputeProjectProgress(deps, tenant.id, projectId);
  deps.logger.info('Project stage updated', {
    tenantId: tenant.id,
    projectId,
    stageId,
    status: updated.status,
  });
  return toStageDto(updated);
}

export async function deleteStage(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
  stageId: string,
): Promise<void> {
  if (!(await projectExists(deps.db, tenant.id, projectId))) {
    throw notFound();
  }

  const deleted = await deleteStageRow(deps.db, tenant.id, projectId, stageId);
  if (!deleted) throw notFound();

  const remaining = await listStages(deps.db, tenant.id, projectId);
  if (remaining.length === 0) {
    await deps.db.query(
      `UPDATE projects SET progress_percentage = 0, updated_at = NOW()
        WHERE tenant_id = $1 AND id = $2`,
      [tenant.id, projectId],
    );
  } else {
    await recomputeProjectProgress(deps, tenant.id, projectId);
  }

  deps.logger.info('Project stage deleted', { tenantId: tenant.id, projectId, stageId });
}

export async function getStageOrFail(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
  stageId: string,
): Promise<StageDto> {
  const stage = await findStageById(deps.db, tenant.id, projectId, stageId);
  if (!stage) throw notFound();
  return toStageDto(stage);
}

export { badRequest };
