import type { Request, Response } from 'express';
import type { AppDependencies } from '../../types/dependencies';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireTenant, requireUser } from '../../utils/context';
import { validatedBody, validatedParams, validatedQuery } from '../../utils/validation';
import type { CreateProjectBody, ListProjectsQuery, ProjectIdParams, UpdateProgressBody } from './project.schemas';
import {
  createProject,
  getProjectForUser,
  listProjectsForUser,
  removeProject,
  updateProjectProgress,
} from './project.service';

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

    create: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const body = validatedBody<CreateProjectBody>(req);
      const project = await createProject(deps, tenant, body);
      res.status(201).json({ success: true, project });
    }),

    remove: asyncHandler(async (req: Request, res: Response) => {
      const tenant = requireTenant(req);
      const { id } = validatedParams<ProjectIdParams>(req);
      await removeProject(deps, tenant, id);
      res.status(200).json({ success: true, message: 'Project deleted successfully.' });
    }),
  };
}
