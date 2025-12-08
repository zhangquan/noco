/**
 * Base Controller Class
 * Provides standardized request handling, error management, and response formatting
 * @module api/base/BaseController
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import type { ApiRequest } from '../../types/index.js';
import { sendSuccess, sendCreated, sendList, sendNoContent, parsePagination } from '../../utils/response.js';
import { ValidationError, NotFoundError, AuthenticationError, AuthorizationError, Errors } from '../../errors/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Handler context with parsed and validated request data
 */
export interface HandlerContext<
  TBody = Record<string, any>,
  TParams = Record<string, string>,
  TQuery = Record<string, any>
> {
  /** Express request object */
  req: ApiRequest;
  /** Express response object */
  res: Response;
  /** Parsed and validated body */
  body: TBody;
  /** Parsed and validated params */
  params: TParams;
  /** Parsed and validated query */
  query: TQuery;
  /** Current user (if authenticated) */
  user: ApiRequest['user'];
  /** User ID shortcut */
  userId: string | undefined;
}

/**
 * Handler function type
 */
export type ControllerHandler<
  TBody = Record<string, any>,
  TParams = Record<string, string>,
  TQuery = Record<string, any>,
  TResult = unknown
> = (
  ctx: HandlerContext<TBody, TParams, TQuery>
) => Promise<TResult>;

/**
 * Validation schemas
 */
export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Controller action options
 */
export interface ActionOptions {
  /** Whether authentication is required */
  requireAuth?: boolean;
  /** Validation schemas */
  validation?: ValidationSchemas;
}

// ============================================================================
// Base Controller Class
// ============================================================================

/**
 * Base controller providing standardized patterns for API endpoints
 * 
 * @example
 * ```typescript
 * class UserController extends BaseController {
 *   list = this.handle(async (ctx) => {
 *     const users = await UserService.list();
 *     return this.list(ctx.res, users, { total: users.length, page: 1, pageSize: 25 });
 *   });
 * 
 *   get = this.handle(
 *     async (ctx) => {
 *       const user = await UserService.get(ctx.params.id);
 *       if (!user) throw Errors.userNotFound(ctx.params.id);
 *       return this.ok(ctx.res, user);
 *     },
 *     { validation: { params: z.object({ id: z.string() }) } }
 *   );
 * }
 * ```
 */
export abstract class BaseController {
  // ============================================================================
  // Request Handler Factory
  // ============================================================================

  /**
   * Create a standardized request handler with error handling and validation
   */
  protected handle<TBody = unknown, TParams = unknown, TQuery = unknown, TResult = unknown>(
    handler: ControllerHandler<TBody, TParams, TQuery, TResult>,
    options: ActionOptions = {}
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const apiReq = req as ApiRequest;

        // Check authentication if required
        if (options.requireAuth !== false && !apiReq.user) {
          throw new AuthenticationError('Authentication required');
        }

        // Validate request data
        const validatedData = this.validateRequest(req, options.validation);

        // Build context
        const ctx: HandlerContext<TBody, TParams, TQuery> = {
          req: apiReq,
          res,
          body: validatedData.body as TBody,
          params: validatedData.params as TParams,
          query: validatedData.query as TQuery,
          user: apiReq.user,
          userId: apiReq.user?.id,
        };

        // Execute handler
        await handler(ctx);
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create a handler that doesn't require authentication
   */
  protected publicHandle<TBody = unknown, TParams = unknown, TQuery = unknown, TResult = unknown>(
    handler: ControllerHandler<TBody, TParams, TQuery, TResult>,
    options: Omit<ActionOptions, 'requireAuth'> = {}
  ): RequestHandler {
    return this.handle(handler, { ...options, requireAuth: false });
  }

  // ============================================================================
  // Response Helpers
  // ============================================================================

  /**
   * Send success response (200)
   */
  protected ok<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    return sendSuccess(res, data, 200, meta);
  }

  /**
   * Send created response (201)
   */
  protected created<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    return sendCreated(res, data, meta);
  }

  /**
   * Send list response with pagination
   */
  protected list<T>(
    res: Response,
    data: T[],
    pagination: { total: number; page: number; pageSize: number },
    meta?: Record<string, unknown>
  ): Response {
    return sendList(res, data, pagination, meta);
  }

  /**
   * Send no content response (204)
   */
  protected noContent(res: Response): Response {
    return sendNoContent(res);
  }

  /**
   * Send accepted response (202)
   */
  protected accepted<T>(res: Response, data?: T, meta?: Record<string, unknown>): Response {
    return sendSuccess(res, data, 202, meta);
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /**
   * Validate request data against schemas
   */
  private validateRequest(
    req: Request,
    schemas?: ValidationSchemas
  ): { body: unknown; params: unknown; query: unknown } {
    const result = {
      body: req.body,
      params: req.params,
      query: req.query,
    };

    if (!schemas) return result;

    try {
      if (schemas.body) {
        result.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        result.params = schemas.params.parse(req.params);
      }
      if (schemas.query) {
        result.query = schemas.query.parse(req.query);
      }
    } catch (error) {
      if (this.isZodError(error)) {
        throw new ValidationError('Validation failed', this.formatZodErrors(error));
      }
      throw error;
    }

    return result;
  }

  /**
   * Check if error is a Zod validation error
   */
  private isZodError(error: unknown): error is ZodError {
    return error instanceof Error && error.name === 'ZodError';
  }

  /**
   * Format Zod errors to our error details format
   */
  private formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
    return error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // ============================================================================
  // Common Helpers
  // ============================================================================

  /**
   * Get pagination parameters from query
   */
  protected getPagination(query: Record<string, unknown>): {
    page: number;
    pageSize: number;
    offset: number;
    limit: number;
  } {
    return parsePagination(query);
  }

  /**
   * Ensure user is authenticated and return user ID
   */
  protected requireUserId(ctx: HandlerContext): string {
    if (!ctx.userId) {
      throw new AuthenticationError('Authentication required');
    }
    return ctx.userId;
  }

  /**
   * Assert resource exists, throw NotFoundError if not
   */
  protected assertFound<T>(resource: T | null | undefined, resourceName: string, id?: string): asserts resource is T {
    if (!resource) {
      throw new NotFoundError(resourceName, id);
    }
  }

  /**
   * Validate required fields
   */
  protected requireFields(data: Record<string, unknown>, fields: string[]): void {
    const missing = fields.filter((field) => data[field] === undefined || data[field] === null);
    if (missing.length > 0) {
      throw Errors.missingField(missing.join(', '));
    }
  }
}

// ============================================================================
// Async Handler Utility
// ============================================================================

/**
 * Wrap async function to handle errors automatically
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a simple handler with error catching
 */
export function createHandler<T>(
  fn: (req: ApiRequest, res: Response) => Promise<T>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req as ApiRequest, res);
    } catch (error) {
      next(error);
    }
  };
}

export default BaseController;
