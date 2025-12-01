/**
 * Input sanitization utilities
 * @module utils/sanitize
 */

import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create DOMPurify instance
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

DOMPurify.setConfig({
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
});

// ============================================================================
// HTML Entity Handling
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x60;': '`',
  '&nbsp;': ' ',
};

function decodeEntities(str: string): string {
  return str.replace(
    /&amp;|&lt;|&gt;|&quot;|&#x27;|&#x60;|&nbsp;/g,
    (match) => HTML_ENTITIES[match] || match
  );
}

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize a value to prevent XSS attacks
 * Recursively sanitizes objects and arrays
 */
export function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return DOMPurify.sanitize(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const sanitizedKey = sanitize(key) as string;
      result[sanitizedKey] = sanitize(val);
    }
    return result;
  }

  return value;
}

/**
 * Decode HTML entities in a value
 */
export function unsanitize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return decodeEntities(value);
  }

  if (Array.isArray(value)) {
    return value.map(unsanitize);
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = unsanitize(val);
    }
    return result;
  }

  return value;
}

/**
 * Sanitize SQL identifier (table/column names)
 */
export function sanitizeIdentifier(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9_.]/g, '');
}

/**
 * Escape single quotes for SQL strings
 */
export function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Check if a value contains potentially dangerous patterns
 */
export function isDangerous(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(value));
}

/**
 * Deep clone and sanitize an object
 */
export function deepSanitize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(sanitize(obj)));
}
