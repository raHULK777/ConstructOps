import type { AuthUser, TenantRecord } from '../../types/domain';
import type { AppDependencies } from '../../types/dependencies';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { findProjectById } from '../project/project.repository';
import { insertComment, listComments, type CommentRow } from './comment.repository';
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
  actor: AuthUser,
  changeOrderId: string,
  reason?: string,
): Promise<ChangeOrderDto> {
  // Clients may reject only their own project's order; staff may reject any.
  const visible =
    actor.role === 'client'
      ? await findChangeOrderForClient(deps.db, tenant.id, changeOrderId, actor.id)
      : await findChangeOrderById(deps.db, tenant.id, changeOrderId);

  if (!visible) throw notFound();
  if (visible.status !== 'pending') {
    throw conflict(`Change order is already ${visible.status}.`);
  }

  const updated = await rejectChangeOrderRow(deps.db, tenant.id, changeOrderId, actor.id);
  if (!updated) {
    throw conflict('Change order is no longer pending.');
  }

  if (reason) {
    try {
      await insertComment(deps.db, tenant.id, changeOrderId, actor.id, reason);
    } catch (error) {
      // The decision stands even if the accompanying note fails to persist.
      deps.logger.warn('Rejection comment failed to persist', {
        tenantId: tenant.id,
        changeOrderId,
        error: (error as Error).message,
      });
    }
  }

  deps.logger.info('Change order rejected', {
    tenantId: tenant.id,
    changeOrderId: updated.id,
    rejectedBy: actor.id,
    byClient: actor.role === 'client',
  });
  return toChangeOrderDto(updated);
}

export interface CommentDto {
  id: string;
  changeOrderId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

function toCommentDto(row: CommentRow): CommentDto {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    changeOrderId: row.change_order_id,
    authorId: row.author_id,
    authorName: name || row.author_email,
    authorRole: row.author_role,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function requireVisibleChangeOrder(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  changeOrderId: string,
): Promise<void> {
  const visible =
    user.role === 'client'
      ? await findChangeOrderForClient(deps.db, tenant.id, changeOrderId, user.id)
      : await findChangeOrderById(deps.db, tenant.id, changeOrderId);
  if (!visible) throw notFound();
}

export async function listChangeOrderComments(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  changeOrderId: string,
): Promise<CommentDto[]> {
  await requireVisibleChangeOrder(deps, tenant, user, changeOrderId);
  const rows = await listComments(deps.db, tenant.id, changeOrderId);
  return rows.map(toCommentDto);
}

export async function addChangeOrderComment(
  deps: AppDependencies,
  tenant: TenantRecord,
  user: AuthUser,
  changeOrderId: string,
  body: string,
): Promise<CommentDto> {
  await requireVisibleChangeOrder(deps, tenant, user, changeOrderId);
  const row = await insertComment(deps.db, tenant.id, changeOrderId, user.id, body);
  deps.logger.info('Change order comment added', {
    tenantId: tenant.id,
    changeOrderId,
    authorId: user.id,
  });
  return toCommentDto(row);
}
