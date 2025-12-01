"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NcError = exports.NcErrorCode = void 0;
/**
 * Error codes for NcError
 */
var NcErrorCode;
(function (NcErrorCode) {
    NcErrorCode["BAD_REQUEST"] = "BAD_REQUEST";
    NcErrorCode["NOT_FOUND"] = "NOT_FOUND";
    NcErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    NcErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    NcErrorCode["FORBIDDEN"] = "FORBIDDEN";
    NcErrorCode["CONFLICT"] = "CONFLICT";
    NcErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    NcErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
})(NcErrorCode || (exports.NcErrorCode = NcErrorCode = {}));
/**
 * HTTP status codes mapping
 */
const StatusCodes = {
    [NcErrorCode.BAD_REQUEST]: 400,
    [NcErrorCode.NOT_FOUND]: 404,
    [NcErrorCode.INTERNAL_SERVER_ERROR]: 500,
    [NcErrorCode.UNAUTHORIZED]: 401,
    [NcErrorCode.FORBIDDEN]: 403,
    [NcErrorCode.CONFLICT]: 409,
    [NcErrorCode.VALIDATION_ERROR]: 422,
    [NcErrorCode.DATABASE_ERROR]: 500,
};
/**
 * Custom error class for NocoDB operations
 */
class NcError extends Error {
    code;
    statusCode;
    details;
    constructor(message, code = NcErrorCode.INTERNAL_SERVER_ERROR, details) {
        super(message);
        this.name = 'NcError';
        this.code = code;
        this.statusCode = StatusCodes[code];
        this.details = details;
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NcError);
        }
    }
    /**
     * Bad request error (400)
     */
    static badRequest(message, details) {
        throw new NcError(message, NcErrorCode.BAD_REQUEST, details);
    }
    /**
     * Not found error (404)
     */
    static notFound(message, details) {
        throw new NcError(message, NcErrorCode.NOT_FOUND, details);
    }
    /**
     * Internal server error (500)
     */
    static internalServerError(message, details) {
        throw new NcError(message, NcErrorCode.INTERNAL_SERVER_ERROR, details);
    }
    /**
     * Unauthorized error (401)
     */
    static unauthorized(message, details) {
        throw new NcError(message, NcErrorCode.UNAUTHORIZED, details);
    }
    /**
     * Forbidden error (403)
     */
    static forbidden(message, details) {
        throw new NcError(message, NcErrorCode.FORBIDDEN, details);
    }
    /**
     * Conflict error (409)
     */
    static conflict(message, details) {
        throw new NcError(message, NcErrorCode.CONFLICT, details);
    }
    /**
     * Validation error (422)
     */
    static validationError(message, details) {
        throw new NcError(message, NcErrorCode.VALIDATION_ERROR, details);
    }
    /**
     * Database error (500)
     */
    static databaseError(message, details) {
        throw new NcError(message, NcErrorCode.DATABASE_ERROR, details);
    }
    /**
     * Record not found helper
     */
    static recordNotFound(id, tableName) {
        const message = tableName
            ? `Record with id '${id}' not found in table '${tableName}'`
            : `Record with id '${id}' not found`;
        throw new NcError(message, NcErrorCode.NOT_FOUND, { id, tableName });
    }
    /**
     * Table not found helper
     */
    static tableNotFound(tableId) {
        throw new NcError(`Table with id '${tableId}' not found`, NcErrorCode.NOT_FOUND, {
            tableId,
        });
    }
    /**
     * Column not found helper
     */
    static columnNotFound(columnId) {
        throw new NcError(`Column with id '${columnId}' not found`, NcErrorCode.NOT_FOUND, { columnId });
    }
    /**
     * Required field missing helper
     */
    static requiredFieldMissing(fieldName) {
        throw new NcError(`Required field '${fieldName}' is missing`, NcErrorCode.VALIDATION_ERROR, { fieldName });
    }
    /**
     * Convert error to JSON
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}
exports.NcError = NcError;
//# sourceMappingURL=NcError.js.map