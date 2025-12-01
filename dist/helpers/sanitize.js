"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = sanitize;
exports.unsanitize = unsanitize;
exports.sanitizeIdentifier = sanitizeIdentifier;
exports.escapeSingleQuotes = escapeSingleQuotes;
exports.isPotentiallyDangerous = isPotentiallyDangerous;
exports.deepSanitize = deepSanitize;
const dompurify_1 = __importDefault(require("dompurify"));
const jsdom_1 = require("jsdom");
// Create DOMPurify instance with JSDOM window
const window = new jsdom_1.JSDOM('').window;
const DOMPurify = (0, dompurify_1.default)(window);
/**
 * Configure DOMPurify
 */
DOMPurify.setConfig({
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [], // Strip all attributes
    KEEP_CONTENT: true, // Keep text content
});
/**
 * HTML entities to decode
 */
const HTML_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x60;': '`',
    '&nbsp;': ' ',
};
/**
 * Decode HTML entities
 */
function decodeHTMLEntities(str) {
    return str.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#x60;|&nbsp;/g, (match) => HTML_ENTITIES[match] || match);
}
/**
 * Sanitize a value to prevent XSS attacks
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
function sanitize(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        // Sanitize string using DOMPurify
        return DOMPurify.sanitize(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitize(item));
    }
    if (typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            // Sanitize the key as well to prevent prototype pollution
            const sanitizedKey = sanitize(key);
            result[sanitizedKey] = sanitize(val);
        }
        return result;
    }
    // Numbers, booleans, etc. are returned as-is
    return value;
}
/**
 * Unsanitize a value (decode HTML entities)
 * @param value - Value to unsanitize
 * @returns Unsanitized value
 */
function unsanitize(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'string') {
        return decodeHTMLEntities(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => unsanitize(item));
    }
    if (typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = unsanitize(val);
        }
        return result;
    }
    return value;
}
/**
 * Sanitize SQL identifier (table/column names)
 * Prevents SQL injection in identifiers
 * @param identifier - SQL identifier
 * @returns Sanitized identifier
 */
function sanitizeIdentifier(identifier) {
    // Remove any characters that aren't alphanumeric, underscore, or dot
    return identifier.replace(/[^a-zA-Z0-9_.]/g, '');
}
/**
 * Escape single quotes for SQL strings
 * @param value - Value to escape
 * @returns Escaped value
 */
function escapeSingleQuotes(value) {
    return value.replace(/'/g, "''");
}
/**
 * Check if a value is potentially dangerous (contains script tags, etc.)
 * @param value - Value to check
 * @returns True if potentially dangerous
 */
function isPotentiallyDangerous(value) {
    if (typeof value !== 'string') {
        return false;
    }
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // Event handlers like onclick=
        /data:text\/html/i,
        /vbscript:/i,
    ];
    return dangerousPatterns.some((pattern) => pattern.test(value));
}
/**
 * Deep clone and sanitize an object
 * @param obj - Object to clone and sanitize
 * @returns Cloned and sanitized object
 */
function deepSanitize(obj) {
    return JSON.parse(JSON.stringify(sanitize(obj)));
}
//# sourceMappingURL=sanitize.js.map