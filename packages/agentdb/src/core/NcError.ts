/**
 * Error handling for model operations
 * @module core/ModelError
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for ModelError
 */
export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * HTTP status codes mapping
 */
export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.DATABASE_ERROR]: 500,
};

// ============================================================================
// ModelError Class
// ============================================================================

/**
 * Custom error class for model operations
 */
export class ModelError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.statusCode = HTTP_STATUS[code];
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModelError);
    }
  }

  // ==========================================================================
  // Static Factory Methods
  // ==========================================================================

  static badRequest(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.BAD_REQUEST, details);
  }

  static notFound(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.NOT_FOUND, details);
  }

  static internalError(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.INTERNAL_SERVER_ERROR, details);
  }

  static unauthorized(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.UNAUTHORIZED, details);
  }

  static forbidden(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.FORBIDDEN, details);
  }

  static conflict(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.CONFLICT, details);
  }

  static validationError(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.VALIDATION_ERROR, details);
  }

  static databaseError(message: string, details?: Record<string, unknown>): never {
    throw new ModelError(message, ErrorCode.DATABASE_ERROR, details);
  }

  // ==========================================================================
  // Domain-Specific Helpers
  // ==========================================================================

  static recordNotFound(id: string, tableName?: string): never {
    const message = tableName
      ? `Record '${id}' not found in '${tableName}'`
      : `Record '${id}' not found`;
    throw new ModelError(message, ErrorCode.NOT_FOUND, { id, tableName });
  }

  static tableNotFound(tableId: string): never {
    throw new ModelError(`Table '${tableId}' not found`, ErrorCode.NOT_FOUND, { tableId });
  }

  static columnNotFound(columnId: string): never {
    throw new ModelError(`Column '${columnId}' not found`, ErrorCode.NOT_FOUND, { columnId });
  }

  static requiredField(fieldName: string): never {
    throw new ModelError(
      `Required field '${fieldName}' is missing`,
      ErrorCode.VALIDATION_ERROR,
      { fieldName }
    );
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * @deprecated Use ModelError instead
 */
export const NcError = ModelError;

/**
 * ModelError type alias
 */
export type ModelErrorType = ModelError;

/**
 * @deprecated Use ModelErrorType instead
 */
export type NcErrorType = ModelError;
