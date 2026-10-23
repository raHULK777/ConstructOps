import type { ProjectStatus } from '../../types/domain';
import type { ProjectRow } from './project.repository';

export interface ProjectDto {
  id: string;
  clientId: string | null;
  projectName: string;
  status: ProjectStatus;
  currentPhase: string | null;
  progressPercentage: number;
  estimatedCost: number;
  updatedAt: string;
}

export function toProjectDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    clientId: row.client_id,
    projectName: row.project_name,
    status: row.status,
    currentPhase: row.current_phase,
    progressPercentage: row.progress_percentage,
    estimatedCost: Number(row.estimated_cost),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
