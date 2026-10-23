import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { findProjectById } from '../project/project.repository';
import { toChangeOrderDto, type ChangeOrderDto } from './changeOrder.mapper';
import {
  approveChangeOrderRow,
  findChangeOrderById,
  findChangeOrderForClient,
  insertChangeOrder,
  listChangeOrders,
  rejectChangeOrderRow,
} from './changeOrder.repository';
import type { CreateChangeOrderBody, ListChangeOrdersQuery } from './changeOrder.schemas';

export async function createChangeOrder(
  deps: AppDependencies,
  tenant: TenantRecord,
  body: CreateChangeOrderBody,
): Promise<ChangeOrderDto> {
  const project = await findProjectById(deps.db, tenant.id, body.projectId);
  if (!project) {
    throw badRequest('projectId must reference a project within this tenant.');
  }

  const row = await insertChangeOrder(deps.db, tenant.id, {
    projectId: body.projectId,
    title: body.title,
    description: body.description ?? null,
    costImpact: body.costImpact,
  });

  deps.logger.info('Change order created', {
    tenantId: tenant.id,
    changeOrderId: row.id,
    projectId: row.project_id,
  });
  return toChangeOrderDto(row);
}

export async function listChangeOrdersForUser(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  query: ListChangeOrdersQuery,
): Promise<ChangeOrderDto[]> {
  const rows = await listChangeOrders(deps.db, tenant.id, {
    clientId: user.role === 'client' ? user.id : null,
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.status ? { status: query.status } : {}),
    limit: query.limit,
  });
  return rows.map(toChangeOrderDto);
}

export async function getChangeOrderForUser(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  changeOrderId: string,
): Promise<ChangeOrderDto> {
  const row =
    user.role === 'client'
      ? await findChangeOrderForClient(deps.db, tenant.id, changeOrderId, user.id)
      : await findChangeOrderById(deps.db, tenant.id, changeOrderId);

  if (!row) throw notFound();
  return toChangeOrderDto(row);
}

export interface ApprovalResult {
  message: string;
  auditTrail: {
    changeOrderId: string;
    status: 'approved';
    signedBy: string;
    signedAt: string;
    ipAddress: string | null;
  };
}

/**
 * The legal execution loop. Ownership is proven twice: the lookup joins the
 * project and requires client_id = session user, and the UPDATE only succeeds
 * while the row is still pending (so a double click cannot sign twice).
 */
export async function approveChangeOrder(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  changeOrderId: string,
  ipAddress: string | null,
): Promise<ApprovalResult> {
  const owned = await findChangeOrderForClient(deps.db, tenant.id, changeOrderId, user.id);
  if (!owned) throw notFound();

  if (owned.status !== 'pending') {
    throw conflict(`Change order is already ${owned.status}.`);
  }

  const signedAt = new Date().toISOString();
  const updated = await approveChangeOrderRow(deps.db, {
    tenantId: tenant.id,
    changeOrderId,
    signedBy: user.id,
    signedAt,
    ipAddress,
  });

  if (!updated) {
    throw conflict('Change order is no longer pending.');
  }

  deps.logger.info('Change order approved', {
    tenantId: tenant.id,
    changeOrderId: updated.id,
    signedBy: user.id,
    ipAddress,
  });

  return {
    message: 'Change order execution loop closed successfully.',
    auditTrail: {
      changeOrderId: updated.id,
      status: 'approved',
      signedBy: user.id,
      signedAt: new Date(updated.signed_at ?? signedAt).toISOString(),
      ipAddress: updated.ip_address,
    },
  };
}

export async function rejectChangeOrder(
  deps: AppDependencies,
  tenant: TenantRecord,
  changeOrderId: string,
): Promise<ChangeOrderDto> {
  const updated = await rejectChangeOrderRow(deps.db, tenant.id, changeOrderId);
  if (updated) {
    deps.logger.info('Change order rejected', {
      tenantId: tenant.id,
      changeOrderId: updated.id,
    });
    return toChangeOrderDto(updated);
  }

  const existing = await findChangeOrderById(deps.db, tenant.id, changeOrderId);
  if (!existing) throw notFound();
  throw conflict(`Change order is already ${existing.status}.`);
}
