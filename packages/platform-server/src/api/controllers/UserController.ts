/**
 * User Controller
 * Handles user management endpoints
 * @module api/controllers/UserController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../../services/UserService.js';
import { sendSuccess, sendList, parsePagination } from '../../utils/response.js';
import { ValidationError, AuthenticationError } from '../../errors/index.js';
import type { ApiRequest } from '../../types/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const UpdateProfileSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const UpdateUserSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  email: z.string().email().optional(),
  roles: z.enum(['super', 'org-level-creator', 'org-level-viewer', 'user', 'guest']).optional(),
  email_verified: z.boolean().optional(),
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
// Route Handlers - Current User
// ============================================================================

/**
 * GET /users/me - Get current user
 */
async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const user = await UserService.getByIdOrFail(userId);
    sendSuccess(res, UserService.toSafeUser(user));
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /users/me - Update current user profile
 */
async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const body = validateBody(UpdateProfileSchema, req.body);
    const user = await UserService.updateProfile(userId, body);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /users/me/password - Change current user password
 */
async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const body = validateBody(ChangePasswordSchema, req.body);
    await UserService.changePassword(userId, body.currentPassword, body.newPassword);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Admin User Management
// ============================================================================

/**
 * GET /users - List all users (admin)
 */
async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuth(req);
    const users = await UserService.listAll();
    const pagination = parsePagination(req.query as Record<string, unknown>);
    
    sendList(res, users, {
      total: users.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /users/:userId - Get user by ID (admin)
 */
async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuth(req);
    const { userId } = req.params;
    const user = await UserService.getByIdOrFail(userId);
    sendSuccess(res, UserService.toSafeUser(user));
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /users/:userId - Update user (admin)
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuth(req);
    const { userId } = req.params;
    const body = validateBody(UpdateUserSchema, req.body);
    const user = await UserService.updateUser(userId, body);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /users/:userId - Delete user (admin)
 */
async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuth(req);
    const { userId } = req.params;
    await UserService.deleteUser(userId);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createUserRouter(): Router {
  const router = Router();

  // Current user routes
  router.get('/me', me);
  router.patch('/me', updateProfile);
  router.post('/me/password', changePassword);

  // Admin routes
  router.get('/', list);
  router.get('/:userId', get);
  router.patch('/:userId', update);
  router.delete('/:userId', deleteUser);

  return router;
}

// Export individual handlers for testing
export { me, updateProfile, changePassword, list, get, update, deleteUser };

export default createUserRouter;
