/**
 * Project Controller
 * Handles project management endpoints
 * @module controllers/ProjectController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ProjectService, type CreateProjectInput, type UpdateProjectInput } from '../services/ProjectService.js';
import { UserService } from '../services/UserService.js';
import { sendSuccess, sendCreated, sendList, parsePagination } from '../utils/response.js';
import { ValidationError, AuthenticationError, NotFoundError } from '../errors/index.js';
import type { ApiRequest, ProjectRole } from '../types/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional(),
  prefix: z.string().max(20).optional(),
  org_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const UpdateProjectSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().optional(),
  order: z.number().int().optional(),
  meta: z.record(z.unknown()).optional(),
});

const InviteUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  roles: z.enum(['owner', 'creator', 'editor', 'viewer', 'commenter', 'guest']).optional(),
});

const UpdateUserRoleSchema = z.object({
  roles: z.enum(['owner', 'creator', 'editor', 'viewer', 'commenter', 'guest']),
});

// ============================================================================
// Helper Functions
// ============================================================================

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }
  return result.data;
}

function requireAuth(req: Request): string {
  const apiReq = req as ApiRequest;
  if (!apiReq.user?.id) {
    throw new AuthenticationError('Authentication required');
  }
  return apiReq.user.id;
}

// ============================================================================
// Route Handlers - Project CRUD
// ============================================================================

/**
 * GET /projects - List projects for current user
 */
async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    
    const result = await ProjectService.listForUserPaginated(
      userId,
      pagination.page,
      pagination.pageSize
    );

    sendList(res, result.data, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /projects/:projectId - Get project by ID
 */
async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    
    const project = await ProjectService.getByIdOrFail(projectId);

    // Check access
    const hasAccess = await ProjectService.hasAccess(project.id, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /projects - Create new project
 */
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const body = validateBody(CreateProjectSchema, req.body);
    const project = await ProjectService.createProject(body as CreateProjectInput, userId);
    sendCreated(res, project);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /projects/:projectId - Update project
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(UpdateProjectSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const project = await ProjectService.updateProject(projectId, body as UpdateProjectInput);
    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /projects/:projectId - Delete project (soft delete)
 */
async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'delete');

    await ProjectService.deleteProject(projectId);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Project User Management
// ============================================================================

/**
 * GET /projects/:projectId/users - List project users
 */
async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const users = await ProjectService.listUsers(projectId);
    
    // Remove sensitive fields
    const safeUsers = users.map(({ ...u }) => ({
      ...u,
      password: undefined,
      salt: undefined,
    }));

    sendList(res, safeUsers, {
      total: safeUsers.length,
      page: 1,
      pageSize: safeUsers.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /projects/:projectId/users - Invite user to project
 */
async function inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(InviteUserSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'invite');

    // Find or create user
    let user = await UserService.getByEmail(body.email);
    if (!user) {
      // Create invite-only user
      const safeUser = await UserService.createUser({
        email: body.email,
        roles: 'user',
        invite_token: Math.random().toString(36).substring(2),
      });
      user = await UserService.getByIdOrFail(safeUser.id);
    }

    // Add to project
    await ProjectService.addUser(
      projectId,
      user.id,
      (body.roles as ProjectRole) || 'viewer'
    );

    sendSuccess(res, {
      success: true,
      user: UserService.toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /projects/:projectId/users/:userId - Update user role
 */
async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUserId = requireAuth(req);
    const { projectId, userId } = req.params;
    const body = validateBody(UpdateUserRoleSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, currentUserId, 'invite');

    await ProjectService.updateUserRole(projectId, userId, body.roles as ProjectRole);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /projects/:projectId/users/:userId - Remove user from project
 */
async function removeUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentUserId = requireAuth(req);
    const { projectId, userId } = req.params;

    // Check permission (only owners can remove users, or users can remove themselves)
    const isOwner = await ProjectService.hasPermission(projectId, currentUserId, 'invite');
    const isSelf = currentUserId === userId;

    if (!isOwner && !isSelf) {
      await ProjectService.requirePermission(projectId, currentUserId, 'invite');
    }

    await ProjectService.removeUser(projectId, userId);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createProjectRouter(): Router {
  const router = Router();

  // Project CRUD
  router.get('/', list);
  router.post('/', create);
  router.get('/:projectId', get);
  router.patch('/:projectId', update);
  router.delete('/:projectId', deleteProject);

  // Project users
  router.get('/:projectId/users', listUsers);
  router.post('/:projectId/users', inviteUser);
  router.patch('/:projectId/users/:userId', updateUserRole);
  router.delete('/:projectId/users/:userId', removeUser);

  return router;
}

// Export for backward compatibility and testing
export {
  list as projectList,
  get as projectGet,
  create as projectCreate,
  update as projectUpdate,
  deleteProject as projectDelete,
};

export default createProjectRouter;
