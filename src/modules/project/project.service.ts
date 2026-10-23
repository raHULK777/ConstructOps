import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { hashPassword } from '../../utils/password';
import { toProjectDto, type ProjectDto } from './project.mapper';
import {
  deleteProjectRow,
  findClientUser,
  findProjectById,
  findUserByEmail,
  insertClientUser,
  insertProject,
  listProjects,
  updateProjectProgressRow,
  updateProjectRow,
} from './project.repository';
import type {
  CreateProjectBody,
  ListProjectsQuery,
  UpdateProgressBody,
  UpdateProjectBody,
} from './project.schemas';
import { insertStage } from './stage.repository';

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

/**
 * Creates a project, optionally onboarding a brand-new customer account in the
 * same transaction. If the email already belongs to a client in this tenant that
 * account is linked instead, so the customer keeps one login across projects.
 */
export async function createProject(
  deps: AppDependencies,
  tenant: TenantRecord,
  body: CreateProjectBody,
): Promise<ProjectDto> {
  let clientId = body.clientId ?? null;
  let newCustomer: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    passwordHash: string;
  } | null = null;

  if (body.customer) {
    const existing = await findUserByEmail(deps.db, tenant.id, body.customer.email);
    if (existing) {
      if (existing.role !== 'client') {
        throw badRequest('That email belongs to a staff member; choose a different customer email.');
      }
      clientId = existing.id;
    } else {
      if (!body.customer.password) {
        throw badRequest('A temporary password is required to create the customer account.');
      }
      newCustomer = {
        email: body.customer.email,
        firstName: body.customer.firstName,
        lastName: body.customer.lastName,
        phone: body.customer.phone ?? null,
        passwordHash: await hashPassword(body.customer.password, deps.env.bcryptRounds),
      };
    }
  } else if (clientId) {
    const client = await findClientUser(deps.db, tenant.id, clientId);
    if (!client) {
      throw badRequest('clientId must reference a client user within this tenant.');
    }
  }

  const client = await deps.db.connect();
  try {
    await client.query('BEGIN');

    if (newCustomer) {
      clientId = await insertClientUser(client, tenant.id, newCustomer);
    }

    const stages = body.stages ?? [];
    const project = await insertProject(client, tenant.id, {
      projectName: body.projectName,
      clientId,
      status: body.status,
      currentPhase: stages[0] ?? body.currentPhase,
      progressPercentage: body.progressPercentage,
      estimatedCost: body.estimatedCost,
    });

    if (stages.length > 0) {
      for (const [index, name] of stages.entries()) {
        await insertStage(client, tenant.id, project.id, {
          name,
          position: index,
          status: index === 0 ? 'in_progress' : 'pending',
        });
      }
      await client.query(
        `UPDATE projects SET current_phase = $3, progress_percentage = 0, updated_at = NOW()
          WHERE tenant_id = $1 AND id = $2`,
        [tenant.id, project.id, stages[0]],
      );
    }

    await client.query('COMMIT');

    const fresh = await findProjectById(deps.db, tenant.id, project.id);
    if (!fresh) throw new Error('Project disappeared after creation.');

    deps.logger.info('Project created', {
      tenantId: tenant.id,
      projectId: project.id,
      customerOnboarded: newCustomer !== null,
      stages: stages.length,
    });
    return toProjectDto(fresh);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      throw conflict('A customer with this email already exists.');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProject(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
  body: UpdateProjectBody,
): Promise<ProjectDto> {
  if (body.clientId !== undefined && body.clientId !== null) {
    const client = await findClientUser(deps.db, tenant.id, body.clientId);
    if (!client) {
      throw badRequest('clientId must reference a client user within this tenant.');
    }
  }

  const row = await updateProjectRow(deps.db, tenant.id, projectId, body);
  if (!row) throw notFound();

  deps.logger.info('Project updated', { tenantId: tenant.id, projectId });
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

export async function removeProject(
  deps: AppDependencies,
  tenant: TenantRecord,
  projectId: string,
): Promise<void> {
  const deleted = await deleteProjectRow(deps.db, tenant.id, projectId);
  if (!deleted) throw notFound();
  deps.logger.info('Project deleted', { tenantId: tenant.id, projectId });
}
