/**
 * Centralized Error Handling System
 * @module errors
 */

// ============================================================================
// Error Codes
// ============================================================================

export enum ErrorCode {
  // Authentication Errors (1xxx)
  AUTH_REQUIRED = 'AUTH_001',
  INVALID_CREDENTIALS = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  TOKEN_INVALID = 'AUTH_004',
  INSUFFICIENT_PERMISSIONS = 'AUTH_005',
  EMAIL_ALREADY_EXISTS = 'AUTH_006',
  USER_NOT_FOUND = 'AUTH_007',
  PASSWORD_MISMATCH = 'AUTH_008',
  
  // Resource Errors (2xxx)
  RESOURCE_NOT_FOUND = 'RES_001',
  RESOURCE_ALREADY_EXISTS = 'RES_002',
  RESOURCE_CONFLICT = 'RES_003',
  RESOURCE_DELETED = 'RES_004',
  
  // Validation Errors (3xxx)
  VALIDATION_ERROR = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  MISSING_REQUIRED_FIELD = 'VAL_003',
  INVALID_FORMAT = 'VAL_004',
  
  // Database Errors (4xxx)
  DATABASE_ERROR = 'DB_001',
  TRANSACTION_FAILED = 'DB_002',
  CONSTRAINT_VIOLATION = 'DB_003',
  CONNECTION_ERROR = 'DB_004',
  
  // Rate Limit Errors (5xxx)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  TOO_MANY_REQUESTS = 'RATE_002',
  
  // Internal Errors (9xxx)
  INTERNAL_ERROR = 'INT_001',
  SERVICE_UNAVAILABLE = 'INT_002',
  CONFIGURATION_ERROR = 'INT_003',
}

// ============================================================================
// Base Error Class
// ============================================================================

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  expected?: unknown;
  received?: unknown;
  [key: string]: unknown;
}

export interface ApiErrorOptions {
  code?: ErrorCode;
  details?: ErrorDetails | ErrorDetails[];
  cause?: Error;
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails | ErrorDetails[];
  public readonly meta?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || ErrorCode.INTERNAL_ERROR;
    this.details = options.details;
    this.meta = options.meta;
    this.timestamp = new Date();
    this.isOperational = true;

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Authentication Error - 401
 */
export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required', options: Omit<ApiErrorOptions, 'code'> = {}) {
    super(401, message, { ...options, code: ErrorCode.AUTH_REQUIRED });
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error - 403
 */
export class AuthorizationError extends ApiError {
  constructor(message = 'Permission denied', options: Omit<ApiErrorOptions, 'code'> = {}) {
    super(403, message, { ...options, code: ErrorCode.INSUFFICIENT_PERMISSIONS });
    this.name = 'AuthorizationError';
  }
}

/**
 * Not Found Error - 404
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource', id?: string, options: Omit<ApiErrorOptions, 'code'> = {}) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(404, message, { ...options, code: ErrorCode.RESOURCE_NOT_FOUND });
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error - 409
 */
export class ConflictError extends ApiError {
  constructor(message = 'Resource already exists', options: Omit<ApiErrorOptions, 'code'> = {}) {
    super(409, message, { ...options, code: ErrorCode.RESOURCE_ALREADY_EXISTS });
    this.name = 'ConflictError';
  }
}

/**
 * Validation Error - 400
 */
export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: ErrorDetails | ErrorDetails[]) {
    super(400, message, { code: ErrorCode.VALIDATION_ERROR, details });
    this.name = 'ValidationError';
  }

  static missingField(field: string): ValidationError {
    return new ValidationError(`Missing required field: ${field}`, {
      field,
      constraint: 'required',
    });
  }

  static invalidFormat(field: string, expected: string): ValidationError {
    return new ValidationError(`Invalid format for field: ${field}`, {
      field,
      constraint: 'format',
      expected,
    });
  }

  static invalidValue(field: string, value: unknown, constraint: string): ValidationError {
    return new ValidationError(`Invalid value for field: ${field}`, {
      field,
      value,
      constraint,
    });
  }
}

/**
 * Rate Limit Error - 429
 */
export class RateLimitError extends ApiError {
  constructor(
    message = 'Too many requests',
    retryAfter?: number,
    options: Omit<ApiErrorOptions, 'code'> = {}
  ) {
    super(429, message, {
      ...options,
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      meta: { retryAfter, ...options.meta },
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Database Error - 500
 */
export class DatabaseError extends ApiError {
  constructor(message = 'Database operation failed', options: Omit<ApiErrorOptions, 'code'> = {}) {
    super(500, message, { ...options, code: ErrorCode.DATABASE_ERROR });
    this.name = 'DatabaseError';
  }
}

/**
 * Internal Server Error - 500
 */
export class InternalError extends ApiError {
  constructor(message = 'Internal server error', cause?: Error) {
    super(500, message, { code: ErrorCode.INTERNAL_ERROR, cause });
    this.name = 'InternalError';
  }
}

/**
 * Bad Request Error - 400
 */
export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', options: Omit<ApiErrorOptions, 'code'> = {}) {
    super(400, message, { ...options, code: ErrorCode.INVALID_INPUT });
    this.name = 'BadRequestError';
  }
}

// ============================================================================
// Error Factory
// ============================================================================

export const Errors = {
  // Auth
  authRequired: (message?: string) => new AuthenticationError(message),
  invalidCredentials: () => new AuthenticationError('Invalid credentials', { code: ErrorCode.INVALID_CREDENTIALS } as any),
  tokenExpired: () => new AuthenticationError('Token has expired', { code: ErrorCode.TOKEN_EXPIRED } as any),
  tokenInvalid: () => new AuthenticationError('Invalid token', { code: ErrorCode.TOKEN_INVALID } as any),
  permissionDenied: (operation?: string) => 
    new AuthorizationError(operation ? `You do not have permission to ${operation}` : 'Permission denied'),
  
  // Resources
  notFound: (resource: string, id?: string) => new NotFoundError(resource, id),
  projectNotFound: (id?: string) => new NotFoundError('Project', id),
  userNotFound: (id?: string) => new NotFoundError('User', id),
  tableNotFound: (id?: string) => new NotFoundError('Table', id),
  appNotFound: (id?: string) => new NotFoundError('App', id),
  pageNotFound: (id?: string) => new NotFoundError('Page', id),
  flowNotFound: (id?: string) => new NotFoundError('Flow', id),
  
  // Conflict
  emailExists: () => new ConflictError('User with this email already exists'),
  resourceExists: (resource: string) => new ConflictError(`${resource} already exists`),
  
  // Validation
  validation: (message: string, details?: ErrorDetails | ErrorDetails[]) => new ValidationError(message, details),
  missingField: (field: string) => ValidationError.missingField(field),
  invalidFormat: (field: string, expected: string) => ValidationError.invalidFormat(field, expected),
  badRequest: (message: string) => new BadRequestError(message),
  
  // Rate Limit
  rateLimitExceeded: (retryAfter?: number) => new RateLimitError('Too many requests, please try again later', retryAfter),
  
  // Database
  databaseError: (message?: string, cause?: Error) => new DatabaseError(message, { cause }),
  transactionFailed: (cause?: Error) => new DatabaseError('Transaction failed', { code: ErrorCode.TRANSACTION_FAILED, cause } as any),
  
  // Internal
  internal: (message?: string, cause?: Error) => new InternalError(message, cause),
};

// ============================================================================
// Error Type Guards
// ============================================================================

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isOperationalError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.isOperational;
  }
  return false;
}

export function getHttpStatusCode(error: unknown): number {
  if (isApiError(error)) {
    return error.statusCode;
  }
  return 500;
}

// ============================================================================
// Error Response Formatter
// ============================================================================

export interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  statusCode: number;
  details?: ErrorDetails | ErrorDetails[];
  requestId?: string;
  timestamp: string;
  stack?: string;
}

export function formatErrorResponse(
  error: Error | ApiError,
  requestId?: string,
  includeStack = false
): ErrorResponse {
  if (isApiError(error)) {
    return {
      ...error.toJSON(),
      requestId,
      ...(includeStack && { stack: error.stack }),
    } as ErrorResponse;
  }

  return {
    error: error.name || 'Error',
    code: ErrorCode.INTERNAL_ERROR,
    message: error.message || 'An unexpected error occurred',
    statusCode: 500,
    requestId,
    timestamp: new Date().toISOString(),
    ...(includeStack && { stack: error.stack }),
  };
}

export default Errors;
