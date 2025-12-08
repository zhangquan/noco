/**
 * Middleware Module
 * @module middleware
 */

// Error Handling
export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  InternalError,
  BadRequestError,
  Errors,
  ErrorCode,
  isApiError,
  isOperationalError,
  getHttpStatusCode,
  formatErrorResponse,
  type ErrorDetails,
  type ApiErrorOptions,
  type ErrorResponse,
} from '../errors/index.js';

// Validation
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  // Common Schemas
  IdSchema,
  UlidSchema,
  PaginationSchema,
  SortSchema,
  ListQuerySchema,
  EmailSchema,
  PasswordSchema,
  TitleSchema,
  DescriptionSchema,
  // API Schemas
  SignupSchema,
  SigninSchema,
  RefreshTokenSchema,
  PasswordResetRequestSchema,
  PasswordResetSchema,
  ChangePasswordSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectIdParamsSchema,
  UpdateProfileSchema,
  UpdateUserSchema,
  InviteUserSchema,
  ReorderSchema,
  CreatePageSchema,
  UpdatePageSchema,
  CreateFlowSchema,
  UpdateFlowSchema,
  CreateTableSchema,
  UpdateTableSchema,
  CreateColumnSchema,
  CreateLinkSchema,
  ImportSchemaSchema,
  // Types
  type ValidationSchemas,
  type ParsedRequest,
  type SignupInput,
  type SigninInput,
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreatePageInput,
  type UpdatePageInput,
  type CreateFlowInput,
  type UpdateFlowInput,
  type ListQueryInput,
} from './validation.js';

// Logging
export {
  Logger,
  LogLevel,
  initLogger,
  getLogger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logAuditEvent,
  type LogEntry,
  type RequestLogData,
  type ResponseLogData,
  type LoggerConfig,
  type AuditLogEntry,
} from './logging.js';

// Health Check
export {
  performHealthCheck,
  createHealthRouter,
  simpleHealthCheck,
  HealthStatus,
  type ComponentHealth,
  type HealthCheckResult,
  type HealthCheckConfig,
} from './health.js';

// Rate Limiting
export {
  createRateLimit,
  createRateLimitFromPreset,
  createDynamicRateLimit,
  createSlidingWindowRateLimit,
  RateLimitPresets,
  skipPaths,
  skipMethods,
  skipAuthenticated,
  combineSkip,
  type RateLimitConfig,
  type RateLimitPreset,
} from './rateLimit.js';

// Error Handler Middleware
import type { Request, Response, NextFunction } from 'express';
import { isApiError, formatErrorResponse, type ErrorResponse } from '../errors/index.js';
import { getLogger } from './logging.js';

export interface ErrorHandlerOptions {
  includeStack?: boolean;
  logErrors?: boolean;
  onError?: (error: Error, req: Request) => void;
}

/**
 * Create error handler middleware
 */
export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    includeStack = process.env.NODE_ENV !== 'production',
    logErrors = true,
    onError,
  } = options;

  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    // Log error
    if (logErrors) {
      const logger = getLogger();
      logger.error('Request error', err, {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
      });
    }

    // Call custom error handler
    if (onError) {
      try {
        onError(err, req);
      } catch {
        // Ignore errors in custom handler
      }
    }

    // Format and send error response
    const errorResponse = formatErrorResponse(err, req.id, includeStack);
    const statusCode = isApiError(err) ? err.statusCode : 500;

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Not Found handler middleware
 */
export function notFoundHandler() {
  return (req: Request, res: Response): void => {
    res.status(404).json({
      error: 'NotFoundError',
      code: 'RES_001',
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
