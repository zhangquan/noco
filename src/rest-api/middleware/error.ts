/**
 * Error Handling Middleware
 * @module rest-api/middleware/error
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiRequest } from '../types';
import { getConfig } from '../config';

/**
 * Base API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'BAD_REQUEST', 400, details);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Permission denied', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

/**
 * 422 Validation Error
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

/**
 * 429 Rate Limit Exceeded
 */
export class RateLimitError extends ApiError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends ApiError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(message, 'INTERNAL_ERROR', 500, details);
  }
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export function handler(
  fn: (req: ApiRequest, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    Promise.resolve(fn(apiReq, res, next)).catch(next);
  };
}

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  error: Error,
  req: ApiRequest,
  res: Response,
  next: NextFunction
): void {
  // Skip if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  const config = getConfig();

  // Log error
  if (config.enableLogging) {
    console.error('[API Error]', {
      method: req.method,
      path: req.path,
      error: error.message,
      stack: config.logLevel === 'debug' ? error.stack : undefined,
    });
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    res.status(error.status).json(error.toJSON());
    return;
  }

  // Handle ModelError from core (if imported)
  if (error.name === 'ModelError' && 'statusCode' in error) {
    const modelError = error as Error & { code: string; statusCode: number; details?: unknown };
    res.status(modelError.statusCode).json({
      error: {
        code: modelError.code,
        message: modelError.message,
        details: modelError.details,
      },
    });
    return;
  }

  // Handle unknown errors
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : error.message,
      details: isProduction ? undefined : { stack: error.stack },
    },
  });
}

/**
 * 404 Not Found handler
 * For unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
