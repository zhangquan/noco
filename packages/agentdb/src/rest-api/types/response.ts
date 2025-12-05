/**
 * Response Type Definitions
 * @module rest-api/types/response
 */

import type { DataRecord } from '../../types';

/**
 * Pagination information
 */
export interface PageInfo {
  /** Total number of records */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of records per page */
  pageSize: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PagedResponse<T = DataRecord> {
  /** List of records */
  list: T[];
  /** Pagination info */
  pageInfo: PageInfo;
}

/**
 * Count response
 */
export interface CountResponse {
  count: number;
}

/**
 * Exists check response
 */
export interface ExistsResponse {
  exists: boolean;
}

/**
 * Delete operation response
 */
export interface DeleteResponse {
  deleted: boolean;
}

/**
 * Bulk operation error
 */
export interface BulkError {
  /** Index of the failed item */
  index: number;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

/**
 * Bulk operation result
 */
export interface BulkResult {
  /** Whether all operations succeeded */
  success: boolean;
  /** Number of affected records */
  affected: number;
  /** IDs of created/affected records */
  ids?: string[];
  /** Errors for failed operations */
  errors?: BulkError[];
}

/**
 * Link operation result
 */
export interface LinkResult {
  /** Number of records linked */
  linked: number;
}

/**
 * Unlink operation result
 */
export interface UnlinkResult {
  /** Number of records unlinked */
  unlinked: number;
}

/**
 * Export result (for JSON response)
 */
export interface ExportResult {
  /** Generated filename */
  filename: string;
  /** Export format */
  format: 'csv' | 'xlsx';
  /** Column headers */
  columns?: string[];
  /** Data rows */
  rows?: unknown[][];
  /** Total row count */
  totalRows: number;
}

/**
 * Schema description response
 */
export interface SchemaResponse {
  table: {
    id: string;
    title: string;
    description?: string;
  };
  columns: Array<{
    id: string;
    title: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  relationships: Array<{
    id: string;
    title: string;
    type: 'mm' | 'hm' | 'bt';
    targetTable: string;
  }>;
}

/**
 * Tables overview response
 */
export interface TablesOverviewResponse {
  tables: Array<{
    id: string;
    title: string;
    description?: string;
    columnCount: number;
    relationCount: number;
  }>;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    /** Error code */
    code: string;
    /** Human-readable message */
    message: string;
    /** Additional details */
    details?: unknown;
  };
}
