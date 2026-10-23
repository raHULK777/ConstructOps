import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant, requireUser } from '../../utils/context';
import { validatedBody, validatedParams, validatedQuery } from '../../utils/validation';
import type {
  CreateProjectBody,
  CreateStageBody,
  ListProjectsQuery,
  ProjectIdParams,
  StageParams,
  UpdateProgressBody,
  UpdateProjectBody,
  UpdateStageBody,
} from './project.schemas';
import {
  createProject,
  getProjectForUser,
  listProjectsForUser,
  removeProject,
  updateProject,
  updateProjectProgress,
} from './project.service';
import {
  createStage,
  deleteStage,
  listStagesForUser,
  updateStage,
} from './stage.service';

export function createProjectController(deps: AppDependencies) {
  return {
    list: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const query = validatedQuery<ListProjectsQuery>(req);
      const projects = await listProjectsForUser(deps, tenant, user, query);
      res.status(200).json({ success: true, projects });
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      const project = await getProjectForUser(deps, tenant, user, id);
      res.status(200).json({ success: true, project });
    }),

    create: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<CreateProjectBody>(req);
      const project = await createProject(deps, tenant, body);
      res.status(201).json({ success: true, project });
    }),

    update: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      const body = validatedBody<UpdateProjectBody>(req);
      const project = await updateProject(deps, tenant, id, body);
      res.status(200).json({
        success: true,
        message: 'Project updated successfully.',
        project,
      });
    }),

    updateProgress: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      const body = validatedBody<UpdateProgressBody>(req);
      const project = await updateProjectProgress(deps, tenant, id, body);
      res.status(200).json({
        success: true,
        message: 'Project progress updated successfully.',
        updatedProject: project,
      });
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      await removeProject(deps, tenant, id);
      res.status(200).json({ success: true, message: 'Project deleted successfully.' });
    }),

    listStages: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      const stages = await listStagesForUser(deps, tenant, user, id);
      res.status(200).json({ success: true, stages });
    }),

    createStage: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      const body = validatedBody<CreateStageBody>(req);
      const stage = await createStage(deps, tenant, id, body);
      res.status(201).json({ success: true, stage });
    }),

    updateStage: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const user = requireUser(req);
      const { id, stageId } = validatedParams<StageParams>(req);
      const body = validatedBody<UpdateStageBody>(req);
      const stage = await updateStage(deps, tenant, user, id, stageId, body);
      res.status(200).json({ success: true, stage });
    }),

    deleteStage: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id, stageId } = validatedParams<StageParams>(req);
      await deleteStage(deps, tenant, id, stageId);
      res.status(200).json({ success: true, message: 'Stage deleted successfully.' });
    }),
  };
}
