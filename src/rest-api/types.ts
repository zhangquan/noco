/**
 * REST API Type Definitions
 * @module rest-api/types
 */

import type { Request, Response, NextFunction, Router } from 'express';
import type { Knex } from 'knex';
import type { Table, Column, ListArgs, DataRecord, RequestContext } from '../types';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Extended Express Request with AgentDB context
 */
export interface AgentRequest extends Request {
  /** Database instance */
  db?: Knex;
  /** All table definitions */
  tables?: Table[];
  /** Current user context */
  user?: RequestUser;
  /** Request context for auditing */
  context?: RequestContext;
}

/**
 * User information from auth
 */
export interface RequestUser {
  id: string;
  email?: string;
  display_name?: string;
  roles?: string[];
}

/**
 * Parsed request context
 */
export interface ParsedRequestContext {
  /** Database instance */
  db: Knex;
  /** All table definitions */
  tables: Table[];
  /** Current table */
  table: Table;
  /** Table ID from request */
  tableId: string;
  /** View ID (optional) */
  viewId?: string;
  /** User context */
  user?: RequestUser;
  /** Request context */
  reqContext: RequestContext;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Paged response wrapper
 */
export interface PagedResponse<T = DataRecord> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

/**
 * Single item response
 */
export interface SingleResponse<T = DataRecord> {
  data: T;
}

/**
 * Count response
 */
export interface CountResponse {
  count: number;
}

/**
 * Bulk operation response
 */
export interface BulkOperationResponse {
  success: boolean;
  affectedRows: number;
  insertedIds?: string[];
  errors?: Array<{ index: number; message: string }>;
}

/**
 * Export response
 */
export interface ExportResponse {
  filename: string;
  contentType: string;
  data: Buffer | string;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Standard query parameters for list operations
 */
export interface ListQueryParams {
  /** Page offset */
  offset?: string;
  /** Page size / limit */
  limit?: string;
  /** Legacy where clause format: (field,op,value) */
  where?: string;
  /** Fields to return (comma-separated or array) */
  fields?: string | string[];
  /** Sort order (comma-separated: field1,-field2) */
  sort?: string;
  /** Filter conditions as JSON string */
  filterArrJson?: string;
  /** Sort conditions as JSON string */
  sortArrJson?: string;
  /** Simplified filter object */
  filter?: string;
  /** Simplified sort object */
  sortBy?: string;
}

/**
 * GroupBy query parameters
 */
export interface GroupByQueryParams extends ListQueryParams {
  /** Column to group by */
  column_name?: string;
  /** Aggregation function */
  aggregation?: string;
}

/**
 * Export query parameters
 */
export interface ExportQueryParams {
  /** Fields to export */
  fields?: string | string[];
  /** Starting offset */
  offset?: string;
  /** Format (csv, xlsx) */
  format?: 'csv' | 'xlsx';
}

// ============================================================================
// Route Parameter Types
// ============================================================================

/**
 * Standard route parameters
 */
export interface TableRouteParams {
  /** Organization/workspace name */
  orgs?: string;
  /** Project name */
  projectName?: string;
  /** Table name or ID */
  tableName: string;
}

/**
 * Row-specific route parameters
 */
export interface RowRouteParams extends TableRouteParams {
  /** Row ID */
  rowId: string;
}

/**
 * View-specific route parameters
 */
export interface ViewRouteParams extends TableRouteParams {
  /** View name or ID */
  viewName?: string;
}

/**
 * Nested/relation route parameters
 */
export interface NestedRouteParams extends RowRouteParams {
  /** Relation type (mm, hm, bt) */
  relationType: 'mm' | 'hm' | 'bt';
  /** Column name or ID for the relation */
  columnName: string;
  /** Reference row ID (for link/unlink) */
  refRowId?: string;
}

/**
 * Shared view route parameters
 */
export interface SharedViewRouteParams {
  /** Shared view UUID */
  sharedViewId: string;
}

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Route handler wrapper type
 */
export type HandlerWrapper = (
  handler: (req: AgentRequest, res: Response, next: NextFunction) => void,
  name?: string
) => (req: AgentRequest, res: Response, next: NextFunction) => void;

/**
 * Router registration function
 */
export type RouterRegistration = (router: Router) => void;

// ============================================================================
// Middleware Context Types
// ============================================================================

/**
 * ACL (Access Control List) action types
 */
export type AclAction = 
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'bulkCreate'
  | 'bulkUpdate'
  | 'bulkDelete'
  | 'export'
  | 'link'
  | 'unlink';

/**
 * ACL middleware configuration
 */
export interface AclConfig {
  /** Required action */
  action: AclAction;
  /** Table ID or alias */
  tableId?: string;
  /** Custom permission check function */
  check?: (user: RequestUser, table: Table) => boolean | Promise<boolean>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * API Error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    statusCode: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * REST API configuration
 */
export interface RestApiConfig {
  /** Base path for API routes */
  basePath: string;
  /** Enable public (shared view) APIs */
  enablePublicApis: boolean;
  /** Enable export APIs */
  enableExportApis: boolean;
  /** Maximum export rows */
  maxExportRows: number;
  /** Export timeout in ms */
  exportTimeout: number;
  /** Enable API metrics */
  enableMetrics: boolean;
  /** Default page size */
  defaultPageSize: number;
  /** Maximum page size */
  maxPageSize: number;
}

/**
 * Default REST API configuration
 */
export const DEFAULT_REST_API_CONFIG: RestApiConfig = {
  basePath: '/api/v1/db/data',
  enablePublicApis: true,
  enableExportApis: true,
  maxExportRows: 10000,
  exportTimeout: 30000,
  enableMetrics: false,
  defaultPageSize: 25,
  maxPageSize: 1000,
};
