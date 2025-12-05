/**
 * Request Type Definitions
 * @module rest-api/types/request
 */

import type { Request } from 'express';
import type { Knex } from 'knex';
import type { Table } from '../../types';

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  roles?: string[];
}

/**
 * Request cookie/context for auditing
 */
export interface RequestCookie {
  user?: {
    id: string;
    email?: string;
    display_name?: string;
  };
  ip?: string;
  userAgent?: string;
}

/**
 * Request context injected by middleware
 */
export interface RequestContext {
  /** Database instance */
  db: Knex;
  /** All table definitions */
  tables: Table[];
  /** Current table (resolved from route params) */
  table?: Table;
  /** Current table ID */
  tableId?: string;
  /** Current view ID */
  viewId?: string;
  /** Authenticated user */
  user?: AuthUser;
  /** Cookie/audit context */
  cookie: RequestCookie;
}

/**
 * Extended Express Request with AgentDB context
 */
export interface ApiRequest extends Request {
  /** Injected request context (set by context middleware) */
  context: RequestContext;
  /** Authenticated user (shorthand) */
  user?: AuthUser;
}

/**
 * Partial request type for middleware that runs before context is set
 */
export interface PartialApiRequest extends Request {
  /** Injected request context (may not be set yet) */
  context?: RequestContext;
  /** Authenticated user */
  user?: AuthUser;
}

/**
 * Route parameters for table operations
 */
export interface TableParams {
  tableName: string;
}

/**
 * Route parameters for row operations
 */
export interface RowParams extends TableParams {
  rowId: string;
}

/**
 * Route parameters for column operations
 */
export interface ColumnParams extends RowParams {
  columnName: string;
}

/**
 * Route parameters for export operations
 */
export interface ExportParams extends TableParams {
  format?: 'csv' | 'xlsx';
}

/**
 * Route parameters for shared view operations
 */
export interface SharedViewParams {
  viewId: string;
  rowId?: string;
}
