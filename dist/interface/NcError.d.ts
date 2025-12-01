/**
 * Error codes for NcError
 */
export declare enum NcErrorCode {
    BAD_REQUEST = "BAD_REQUEST",
    NOT_FOUND = "NOT_FOUND",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    CONFLICT = "CONFLICT",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR"
}
/**
 * Custom error class for NocoDB operations
 */
export declare class NcError extends Error {
    readonly code: NcErrorCode;
    readonly statusCode: number;
    readonly details?: Record<string, any>;
    constructor(message: string, code?: NcErrorCode, details?: Record<string, any>);
    /**
     * Bad request error (400)
     */
    static badRequest(message: string, details?: Record<string, any>): never;
    /**
     * Not found error (404)
     */
    static notFound(message: string, details?: Record<string, any>): never;
    /**
     * Internal server error (500)
     */
    static internalServerError(message: string, details?: Record<string, any>): never;
    /**
     * Unauthorized error (401)
     */
    static unauthorized(message: string, details?: Record<string, any>): never;
    /**
     * Forbidden error (403)
     */
    static forbidden(message: string, details?: Record<string, any>): never;
    /**
     * Conflict error (409)
     */
    static conflict(message: string, details?: Record<string, any>): never;
    /**
     * Validation error (422)
     */
    static validationError(message: string, details?: Record<string, any>): never;
    /**
     * Database error (500)
     */
    static databaseError(message: string, details?: Record<string, any>): never;
    /**
     * Record not found helper
     */
    static recordNotFound(id: string, tableName?: string): never;
    /**
     * Table not found helper
     */
    static tableNotFound(tableId: string): never;
    /**
     * Column not found helper
     */
    static columnNotFound(columnId: string): never;
    /**
     * Required field missing helper
     */
    static requiredFieldMissing(fieldName: string): never;
    /**
     * Convert error to JSON
     */
    toJSON(): Record<string, any>;
}
//# sourceMappingURL=NcError.d.ts.map