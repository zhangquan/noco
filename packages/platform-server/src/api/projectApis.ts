/**
 * Project APIs
 * @module api/projectApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Knex } from 'knex';
import { Project } from '../models/Project.js';
import { Database } from '../models/Database.js';
import { AppModel } from '../models/AppModel.js';
import { FlowApp } from '../models/Flow.js';
import { User } from '../models/User.js';
import type { ApiRequest, ProjectRole } from '../types/index.js';
import { getMetaDb } from '../db/index.js';

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * List all projects for the current user
 */
export async function projectList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiReq = req as ApiRequest;
    const userId = apiReq.user?.id;

    let projects;
    if (userId) {
      // Get projects for authenticated user
      projects = await Project.listForUser(userId);
    } else {
      // Get all projects (admin only)
      projects = await Project.list();
    }

    res.json({
      list: projects.map(p => p.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a project by ID
 */
export async function projectGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const project = await Project.get(projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json(project.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new project
 */
export async function projectCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiReq = req as ApiRequest;
    const userId = apiReq.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { title, description, prefix, org_id } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Project title is required' });
      return;
    }

    const db = getMetaDb();

    // Use transaction for atomic operations
    await db.transaction(async (trx: Knex.Transaction) => {
      // 1. Create the project
      const project = await Project.createProject(
        { title, description, prefix, org_id },
        { knex: trx }
      );

      // 2. Add current user as owner
      await Project.addUser(project.id, userId, 'owner', { knex: trx });

      // 3. Create default data server database
      await Database.createBase(
        {
          project_id: project.id,
          type: 'pg',
          is_default_data_server_db: true,
          alias: 'Default',
        },
        { knex: trx }
      );

      // 4. Create default page app
      await AppModel.insert(
        {
          project_id: project.id,
          title: 'Default App',
          type: 'page',
        },
        { knex: trx }
      );

      // 5. Create default flow app
      await FlowApp.insert(
        {
          project_id: project.id,
          title: 'Default Workflows',
        },
        { knex: trx }
      );

      // Return the created project
      const result = await Project.get(project.id, { knex: trx, skipCache: true });
      res.status(201).json(result?.toJSON());
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a project
 */
export async function projectUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { title, description, color, meta } = req.body;

    const project = await Project.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await Project.update(projectId, { title, description, color, meta });

    const updated = await Project.get(projectId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a project (soft delete)
 */
export async function projectDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;

    const project = await Project.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await Project.softDelete(projectId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Project User Management
// ============================================================================

/**
 * List project users
 */
export async function projectUserList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;

    const users = await Project.listUsers(projectId);
    res.json({
      list: users.map(u => ({
        ...u,
        password: undefined,
        salt: undefined,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Invite user to project
 */
export async function projectUserInvite(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { email, roles } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find or create user
    let user = await User.getByEmail(email);
    if (!user) {
      // Create invite-only user
      user = await User.insert({
        email,
        roles: 'user',
        invite_token: Math.random().toString(36).substring(2),
      });
    }

    // Add to project
    await Project.addUser(projectId, user.id, roles as ProjectRole || 'viewer');

    res.json({ success: true, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user role in project
 */
export async function projectUserUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId, userId } = req.params;
    const { roles } = req.body;

    if (!roles) {
      res.status(400).json({ error: 'Role is required' });
      return;
    }

    await Project.updateUserRole(projectId, userId, roles as ProjectRole);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove user from project
 */
export async function projectUserRemove(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId, userId } = req.params;

    await Project.removeUser(projectId, userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createProjectRouter(): Router {
  const router = Router();

  // Project CRUD
  router.get('/', projectList);
  router.post('/', projectCreate);
  router.get('/:projectId', projectGet);
  router.patch('/:projectId', projectUpdate);
  router.delete('/:projectId', projectDelete);

  // Project users
  router.get('/:projectId/users', projectUserList);
  router.post('/:projectId/users', projectUserInvite);
  router.patch('/:projectId/users/:userId', projectUserUpdate);
  router.delete('/:projectId/users/:userId', projectUserRemove);

  return router;
}

export default createProjectRouter;
