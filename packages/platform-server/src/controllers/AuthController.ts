/**
 * Auth Controller
 * Handles authentication endpoints
 * @module controllers/AuthController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { UserService, type SignupInput, type SigninInput } from '../services/UserService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { ValidationError } from '../errors/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const SignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
});

const SigninSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const RefreshTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /auth/signup - Register new user
 */
async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validateBody(SignupSchema, req.body);
    const result = await UserService.signup(body as SignupInput);
    sendCreated(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/signin - User login
 */
async function signin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validateBody(SigninSchema, req.body);
    const result = await UserService.signin(body as SigninInput);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/token/refresh - Refresh access token
 */
async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validateBody(RefreshTokenSchema, req.body);
    const result = await UserService.refreshToken(body.token);
    if (!result) {
      throw new Error('Invalid or expired token');
    }
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/password/forgot - Request password reset
 */
async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validateBody(PasswordResetRequestSchema, req.body);
    await UserService.requestPasswordReset(body.email);
    sendSuccess(res, { message: 'If the email exists, a reset link will be sent' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /auth/password/reset - Reset password with token
 */
async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validateBody(PasswordResetSchema, req.body);
    await UserService.resetPassword(body.token, body.newPassword);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/signup', signup);
  router.post('/signin', signin);
  router.post('/token/refresh', refreshToken);
  router.post('/password/forgot', forgotPassword);
  router.post('/password/reset', resetPassword);

  return router;
}

// Export individual handlers for testing
export { signup, signin, refreshToken, forgotPassword, resetPassword };

export default createAuthRouter;
