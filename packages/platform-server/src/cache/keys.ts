/**
 * Cache Key Builders
 * 
 * Provides standardized, type-safe cache key generation
 * to ensure consistency across the application.
 * 
 * @module cache/keys
 */

import { CacheScope } from '../types/index.js';

// ============================================================================
// Cache Key Builders
// ============================================================================

/**
 * Standardized cache key builders
 * 
 * @example
 * ```typescript
 * // Entity by ID
 * const key = CacheKeys.entity(CacheScope.USER, userId);
 * // => "user:abc123"
 * 
 * // Entity list
 * const key = CacheKeys.list(CacheScope.PROJECT, 'all');
 * // => "project:list:all"
 * 
 * // Secondary index
 * const key = CacheKeys.index(CacheScope.USER, 'email', 'user@example.com');
 * // => "user:email:user@example.com"
 * ```
 */
export const CacheKeys = {
  /**
   * Build key for entity by ID
   */
  entity: (scope: CacheScope, id: string): string => `${scope}:${id}`,

  /**
   * Build key for entity list
   */
  list: (scope: CacheScope, key: string): string => `${scope}:list:${key}`,

  /**
   * Build key for secondary index (e.g., user by email)
   */
  index: (scope: CacheScope, field: string, value: string): string =>
    `${scope}:${field}:${value}`,

  /**
   * Build key for user-specific list
   */
  userList: (scope: CacheScope, userId: string): string =>
    `${scope}:user:${userId}`,

  /**
   * Build key for project-specific resource
   */
  projectResource: (scope: CacheScope, projectId: string, resourceId?: string): string =>
    resourceId ? `${scope}:project:${projectId}:${resourceId}` : `${scope}:project:${projectId}`,

  /**
   * Build pattern for scope-wide invalidation
   */
  scopePattern: (scope: CacheScope): string => `${scope}:*`,

  /**
   * Build pattern for list invalidation
   */
  listPattern: (scope: CacheScope): string => `${scope}:list:*`,
} as const;

// ============================================================================
// Generic Key Builder
// ============================================================================

/**
 * Build a cache key from parts
 * 
 * @example
 * ```typescript
 * const key = cacheKey(CacheScope.USER, 'abc123');
 * // => "user:abc123"
 * 
 * const key = cacheKey(CacheScope.PROJECT, projectId, 'pages');
 * // => "project:proj123:pages"
 * ```
 */
export function cacheKey(scope: CacheScope, ...parts: string[]): string {
  return [scope, ...parts].join(':');
}

// ============================================================================
// Key Parsing
// ============================================================================

/**
 * Parsed cache key parts
 */
export interface CacheKeyParts {
  scope: CacheScope;
  type: 'entity' | 'list' | 'index' | 'other';
  id?: string;
  listKey?: string;
  field?: string;
  value?: string;
}

/**
 * Parse a cache key into its parts
 * 
 * @example
 * ```typescript
 * const parts = parseCacheKey('user:abc123');
 * // => { scope: 'user', type: 'entity', id: 'abc123' }
 * 
 * const parts = parseCacheKey('project:list:all');
 * // => { scope: 'project', type: 'list', listKey: 'all' }
 * ```
 */
export function parseCacheKey(key: string): CacheKeyParts {
  const segments = key.split(':');
  const scope = segments[0] as CacheScope;

  if (segments[1] === 'list') {
    return {
      scope,
      type: 'list',
      listKey: segments.slice(2).join(':'),
    };
  }

  // Check if it's an index key (has 3+ segments and middle isn't an ID format)
  if (segments.length >= 3 && !isIdFormat(segments[1])) {
    return {
      scope,
      type: 'index',
      field: segments[1],
      value: segments.slice(2).join(':'),
    };
  }

  return {
    scope,
    type: 'entity',
    id: segments.slice(1).join(':'),
  };
}

/**
 * Check if a string looks like an entity ID (ULID format)
 */
function isIdFormat(str: string): boolean {
  // ULID is 26 characters, alphanumeric
  return /^[0-9A-Z]{26}$/i.test(str);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a cache key format
 */
export function isValidCacheKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  
  const parts = key.split(':');
  if (parts.length < 2) return false;
  
  // First part should be a valid scope
  const validScopes = Object.values(CacheScope);
  return validScopes.includes(parts[0] as CacheScope);
}
