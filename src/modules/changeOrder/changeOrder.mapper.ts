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
  signedAt: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function toChangeOrderDto(row: ChangeOrderRow): ChangeOrderDto {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    costImpact: Number(row.cost_impact),
    status: row.status,
    signedBy: row.signed_by,
    signedAt: row.signed_at ? new Date(row.signed_at).toISOString() : null,
    ipAddress: row.ip_address,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
