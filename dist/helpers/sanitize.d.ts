/**
 * Sanitize a value to prevent XSS attacks
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
export declare function sanitize(value: unknown): unknown;
/**
 * Unsanitize a value (decode HTML entities)
 * @param value - Value to unsanitize
 * @returns Unsanitized value
 */
export declare function unsanitize(value: unknown): unknown;
/**
 * Sanitize SQL identifier (table/column names)
 * Prevents SQL injection in identifiers
 * @param identifier - SQL identifier
 * @returns Sanitized identifier
 */
export declare function sanitizeIdentifier(identifier: string): string;
/**
 * Escape single quotes for SQL strings
 * @param value - Value to escape
 * @returns Escaped value
 */
export declare function escapeSingleQuotes(value: string): string;
/**
 * Check if a value is potentially dangerous (contains script tags, etc.)
 * @param value - Value to check
 * @returns True if potentially dangerous
 */
export declare function isPotentiallyDangerous(value: unknown): boolean;
/**
 * Deep clone and sanitize an object
 * @param obj - Object to clone and sanitize
 * @returns Cloned and sanitized object
 */
export declare function deepSanitize<T>(obj: T): T;
//# sourceMappingURL=sanitize.d.ts.map