import type { ProjectStatus } from '../../types/domain';
import type { ProjectRow } from './project.repository';

export interface ProjectDto {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  projectName: string;
  status: ProjectStatus;
  currentPhase: string | null;
  progressPercentage: number;
  estimatedCost: number;
  updatedAt: string;
}

export function toProjectDto(row: ProjectRow): ProjectDto {
  const clientName =
    [row.client_first_name, row.client_last_name].filter(Boolean).join(' ').trim() || null;

  return {
    id: row.id,
    clientId: row.client_id,
    clientName,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    projectName: row.project_name,
    status: row.status,
    currentPhase: row.current_phase,
    progressPercentage: row.progress_percentage,
    estimatedCost: Number(row.estimated_cost),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
