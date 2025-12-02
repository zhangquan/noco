/**
 * Query argument type definitions
 * @module types/query
 */

import type { Knex } from 'knex';
import type { Filter, Sort, SimpleFilter, SimpleSort } from './filter';

// ============================================================================
// Query Arguments
// ============================================================================

/**
 * List query arguments
 */
export interface ListArgs {
  /** Fields to select (comma-separated string or array) */
  fields?: string | string[];
  /** Legacy where string format */
  where?: string;
  /** Filter array */
  filterArr?: Filter[];
  /** Sort array */
  sortArr?: Sort[];
  /** Result limit */
  limit?: number;
  /** Result offset */
  offset?: number;
  /** Legacy sort string format */
  sort?: string;
  /** Primary keys (comma-separated) */
  pks?: string;
  /** Direct condition object */
  condition?: Record<string, unknown>;
  /** Parent ID for relation queries */
  parentId?: string;
  
  // === Simplified syntax (AI-friendly) ===
  
  /**
   * Simplified filter object
   * @example { status: 'active', age: { gte: 18 } }
   */
  filter?: SimpleFilter;
  
  /**
   * Simplified sort object
   * @example { created_at: 'desc', name: 'asc' }
   */
  sortBy?: SimpleSort;
}

/**
 * GroupBy query arguments
 */
export interface GroupByArgs extends ListArgs {
  /** Column ID or name to group by */
  columnId: string;
  /** Aggregation function (count, sum, avg, min, max) */
  aggregation?: string;
}

/**
 * Child list arguments for relations
 */
export interface ChildListArgs {
  /** Link column ID */
  colId: string;
  /** Parent row ID */
  parentRowId: string;
  /** Optional child row ID for specific child lookup */
  childRowId?: string;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

/**
 * Bulk operation options
 */
export interface BulkOptions {
  /** Chunk size for batch operations */
  chunkSize?: number;
  /** Request context/cookie */
  cookie?: RequestContext;
  /** Database transaction */
  trx?: Knex.Transaction;
  /** Throw exception if record not found */
  throwExceptionIfNotExist?: boolean;
  /** Skip data validation */
  skipValidation?: boolean;
}

// ============================================================================
// Request Context
// ============================================================================

/**
 * User information in request context
 */
export interface RequestUser {
  id?: string;
  email?: string;
  display_name?: string;
}

/**
 * Request context for tracking user actions
 */
export interface RequestContext {
  user?: RequestUser;
  ip?: string;
  user_agent?: string;
  locale?: string;
}

// ============================================================================
// Record Type
// ============================================================================

/**
 * Generic record type for database rows
 */
export type DataRecord = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  [key: string]: unknown;
};

// ============================================================================
// Bulk Write Types (AI-friendly)
// ============================================================================

/**
 * Insert operation for bulkWrite
 */
export interface BulkInsertOp {
  op: 'insert';
  data: DataRecord;
}

/**
 * Update operation for bulkWrite
 */
export interface BulkUpdateOp {
  op: 'update';
  id: string;
  data: DataRecord;
}

/**
 * Delete operation for bulkWrite
 */
export interface BulkDeleteOp {
  op: 'delete';
  id: string;
}

/**
 * Link operation for bulkWrite
 */
export interface BulkLinkOp {
  op: 'link';
  columnId: string;
  parentId: string;
  childIds: string[];
}

/**
 * Unlink operation for bulkWrite
 */
export interface BulkUnlinkOp {
  op: 'unlink';
  columnId: string;
  parentId: string;
  childIds: string[];
}

/**
 * All possible bulk write operations
 */
export type BulkWriteOperation =
  | BulkInsertOp
  | BulkUpdateOp
  | BulkDeleteOp
  | BulkLinkOp
  | BulkUnlinkOp;

/**
 * Result of a single bulk write operation
 */
export interface BulkWriteOperationResult {
  op: BulkWriteOperation['op'];
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Result of bulkWrite()
 */
export interface BulkWriteResult {
  success: boolean;
  results: BulkWriteOperationResult[];
  insertedIds: string[];
  updatedCount: number;
  deletedCount: number;
  linkedCount: number;
  unlinkedCount: number;
}
