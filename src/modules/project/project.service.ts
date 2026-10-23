import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { badRequest, notFound } from '../../utils/errors';
import { toProjectDto, type ProjectDto } from './project.mapper';
import {
  deleteProjectRow,
  findClientUser,
  findProjectById,
  insertProject,
  listProjects,
  updateProjectProgressRow,
} from './project.repository';
import type { CreateProjectBody, ListProjectsQuery, UpdateProgressBody } from './project.schemas';

export async function listProjectsForUser(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  query: ListProjectsQuery,
): Promise<ProjectDto[]> {
  const rows = await listProjects(deps.db, tenant.id, {
    // A client's tenant scope is always narrowed to their own records. The
    // value comes from the verified session, never from the query string.
    clientId: user.role === 'client' ? user.id : null,
    ...(query.status ? { status: query.status } : {}),
    limit: query.limit,
  });
  return rows.map(toProjectDto);
}

export async function getProjectForUser(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  projectId: string,
): Promise<ProjectDto> {
  const row = await findProjectById(deps.db, tenant.id, projectId);
  if (!row) throw notFound();
  if (user.role === 'client' && row.client_id !== user.id) {
    // Opaque 404: a client must not learn that another client's project exists.
    throw notFound();
  }
  return toProjectDto(row);
}

export async function updateProjectProgress(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
  body: UpdateProgressBody,
): Promise<ProjectDto> {
  const row = await updateProjectProgressRow(deps.db, tenant.id, projectId, body);
  if (!row) throw notFound();
  deps.logger.info('Project progress updated', {
    tenantId: tenant.id,
    projectId,
    progressPercentage: body.progressPercentage,
  });
  return toProjectDto(row);
}

export async function createProject(
  deps: AppDependencies,
  tenant: TenantRecord,
  body: CreateProjectBody,
): Promise<ProjectDto> {
  if (body.clientId) {
    const client = await findClientUser(deps.db, tenant.id, body.clientId);
    if (!client) {
      throw badRequest('clientId must reference a client user within this tenant.');
    }
  }

  const row = await insertProject(deps.db, tenant.id, {
    projectName: body.projectName,
    clientId: body.clientId ?? null,
    status: body.status,
    currentPhase: body.currentPhase,
    progressPercentage: body.progressPercentage,
    estimatedCost: body.estimatedCost,
  });

  deps.logger.info('Project created', { tenantId: tenant.id, projectId: row.id });
  return toProjectDto(row);
}

export async function removeProject(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
): Promise<void> {
  const deleted = await deleteProjectRow(deps.db, tenant.id, projectId);
  if (!deleted) throw notFound();
  deps.logger.info('Project deleted', { tenantId: tenant.id, projectId });
}
