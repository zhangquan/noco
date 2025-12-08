/**
 * Request Context Type Definitions
 * Unified context types for all layers
 * @module types/context
 */

import type { Knex } from 'knex';
import type { Table } from './table';

// ============================================================================
// User Types
// ============================================================================

/**
 * Authenticated user information (minimal, serializable)
 */
export interface AuthUser {
  /** User ID */
  id: string;
  /** Email address */
  email?: string;
  /** Display name */
  displayName?: string;
  /** User roles */
  roles?: string[];
}

/**
 * User information for auditing
 */
export interface AuditUser {
  /** User ID */
  id: string;
  /** Email address */
  email?: string;
  /** Display name (snake_case for DB compatibility) */
  display_name?: string;
}

// ============================================================================
// Audit Context
// ============================================================================

/**
 * Audit/tracking context for logging and history
 */
export interface AuditContext {
  /** User performing the action */
  user?: AuditUser;
  /** Client IP address */
  ip?: string;
  /** User agent string */
  userAgent?: string;
  /** Locale/language */
  locale?: string;
  /** Request ID for tracing */
  requestId?: string;
}

// ============================================================================
// Request Context Types
// ============================================================================

/**
 * Base request context (no DB dependencies)
 * Use for layers that don't need DB access
 */
export interface BaseRequestContext {
  /** Authenticated user */
  user?: AuthUser;
  /** Audit information */
  audit?: AuditContext;
}

/**
 * Database request context
 * Use for DB operations with optional transaction
 */
export interface DbRequestContext extends BaseRequestContext {
  /** Database transaction (optional) */
  trx?: Knex.Transaction;
}

/**
 * Full API request context
 * Use for REST API handlers
 */
export interface ApiRequestContext extends BaseRequestContext {
  /** Knex database instance */
  db: Knex;
  /** All available table definitions */
  tables: Table[];
  /** Current table (resolved from route params) */
  table?: Table;
  /** Current table ID */
  tableId?: string;
  /** Current view ID */
  viewId?: string;
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Legacy RequestUser type
 * @deprecated Use AuthUser or AuditUser instead
 */
export interface RequestUser {
  id?: string;
  email?: string;
  display_name?: string;
}

/**
 * Legacy RequestContext type  
 * @deprecated Use DbRequestContext or ApiRequestContext instead
 */
export interface RequestContext {
  user?: RequestUser;
  ip?: string;
  user_agent?: string;
  locale?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create audit context from request headers
 */
export function createAuditContext(params: {
  user?: AuthUser;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}): AuditContext {
  return {
    user: params.user
      ? {
          id: params.user.id,
          email: params.user.email,
          display_name: params.user.displayName,
        }
      : undefined,
    ip: params.ip,
    userAgent: params.userAgent,
    requestId: params.requestId,
  };
}

/**
 * Convert AuthUser to AuditUser
 */
export function toAuditUser(user: AuthUser): AuditUser {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
  };
}

/**
 * Convert legacy RequestContext to DbRequestContext
 */
export function fromLegacyContext(ctx: RequestContext): DbRequestContext {
  return {
    user: ctx.user
      ? {
          id: ctx.user.id || '',
          email: ctx.user.email,
          displayName: ctx.user.display_name,
        }
      : undefined,
    audit: {
      user: ctx.user
        ? {
            id: ctx.user.id || '',
            email: ctx.user.email,
            display_name: ctx.user.display_name,
          }
        : undefined,
      ip: ctx.ip,
      userAgent: ctx.user_agent,
      locale: ctx.locale,
    },
  };
}
