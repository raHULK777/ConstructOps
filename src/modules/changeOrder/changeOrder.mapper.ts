import type { ChangeOrderStatus } from '../../types/domain';
import type { ChangeOrderRow } from './changeOrder.repository';

export interface ChangeOrderDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  costImpact: number;
  status: ChangeOrderStatus;
  signedBy: string | null;
  signedByName: string | null;
  signedAt: string | null;
  ipAddress: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export function toChangeOrderDto(row: ChangeOrderRow): ChangeOrderDto {
  const signedByName =
    [row.signed_by_first, row.signed_by_last].filter(Boolean).join(' ').trim() || null;
  const rejectedByName =
    [row.rejected_by_first, row.rejected_by_last].filter(Boolean).join(' ').trim() || null;

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    costImpact: Number(row.cost_impact),
    status: row.status,
    signedBy: row.signed_by,
    signedByName,
    signedAt: row.signed_at ? new Date(row.signed_at).toISOString() : null,
    ipAddress: row.ip_address,
    rejectedBy: row.rejected_by,
    rejectedByName,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
