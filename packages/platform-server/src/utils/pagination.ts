/**
 * Pagination Utilities
 * @module utils/pagination
 */

import type { Knex } from 'knex';

// ============================================================================
// Types
// ============================================================================

export interface PaginationInput {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortInput {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationOptions extends PaginationInput, SortInput {}

export interface PaginatedResult<T> {
  list: T[];
  pageInfo: PageInfo;
}

export interface PageInfo {
  page: number;
  limit: number;
  offset: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Pagination Constants
// ============================================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 1000;
export const MIN_LIMIT = 1;

// ============================================================================
// Pagination Functions
// ============================================================================

/**
 * Parse and normalize pagination options
 */
export function parsePaginationOptions(input: PaginationInput = {}): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, input.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, input.limit || DEFAULT_LIMIT));
  const offset = input.offset ?? (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse sort options with validation
 */
export function parseSortOptions(
  input: SortInput = {},
  allowedColumns: string[] = []
): {
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
} {
  const sortOrder = input.sortOrder === 'desc' ? 'desc' : 'asc';
  
  if (!input.sortBy) {
    return { sortOrder };
  }

  // Validate column name if allowed columns are specified
  if (allowedColumns.length > 0 && !allowedColumns.includes(input.sortBy)) {
    return { sortOrder };
  }

  return { sortBy: input.sortBy, sortOrder };
}

/**
 * Create page info object
 */
export function createPageInfo(
  totalCount: number,
  pagination: { page: number; limit: number; offset: number }
): PageInfo {
  const totalPages = Math.ceil(totalCount / pagination.limit);

  return {
    page: pagination.page,
    limit: pagination.limit,
    offset: pagination.offset,
    totalCount,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPreviousPage: pagination.page > 1,
  };
}

/**
 * Apply pagination to a Knex query builder
 */
export function applyPagination<T extends Record<string, unknown>>(
  query: Knex.QueryBuilder<T, T[]>,
  pagination: { limit: number; offset: number }
): Knex.QueryBuilder<T, T[]> {
  return query.limit(pagination.limit).offset(pagination.offset);
}

/**
 * Apply sorting to a Knex query builder
 */
export function applySort<T extends Record<string, unknown>>(
  query: Knex.QueryBuilder<T, T[]>,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): Knex.QueryBuilder<T, T[]> {
  if (sortBy) {
    return query.orderBy(sortBy, sortOrder);
  }
  return query;
}

/**
 * Get count for a table with optional conditions
 */
export async function getCount(
  db: Knex,
  table: string,
  condition?: Record<string, unknown>
): Promise<number> {
  let query = db(table);
  
  if (condition) {
    query = query.where(condition);
  }
  
  const result = await query.count({ count: '*' }).first();
  return Number(result?.count || 0);
}

// ============================================================================
// Paginated Query Helper
// ============================================================================

export interface PaginatedQueryOptions<T> {
  db: Knex;
  table: string;
  condition?: Record<string, unknown>;
  pagination?: PaginationInput;
  sort?: SortInput;
  allowedSortColumns?: string[];
  defaultSort?: { column: string; order: 'asc' | 'desc' };
  select?: string[];
  transform?: (row: Record<string, unknown>) => T;
}

/**
 * Execute a paginated query and return results with page info
 */
export async function paginatedQuery<T = Record<string, unknown>>(
  options: PaginatedQueryOptions<T>
): Promise<PaginatedResult<T>> {
  const {
    db,
    table,
    condition,
    pagination: paginationInput,
    sort: sortInput,
    allowedSortColumns,
    defaultSort,
    select,
    transform,
  } = options;

  // Parse pagination and sort options
  const pagination = parsePaginationOptions(paginationInput);
  const sort = parseSortOptions(sortInput, allowedSortColumns);

  // Build base query
  let query = db(table);
  let countQuery = db(table);

  if (condition) {
    query = query.where(condition);
    countQuery = countQuery.where(condition);
  }

  // Apply select
  if (select && select.length > 0) {
    query = query.select(select);
  }

  // Apply sorting
  if (sort.sortBy) {
    query = query.orderBy(sort.sortBy, sort.sortOrder);
  } else if (defaultSort) {
    query = query.orderBy(defaultSort.column, defaultSort.order);
  }

  // Apply pagination
  query = query.limit(pagination.limit).offset(pagination.offset);

  // Execute queries
  const [rows, countResult] = await Promise.all([
    query,
    countQuery.count({ count: '*' }).first(),
  ]);

  const totalCount = Number(countResult?.count || 0);

  // Transform results if needed
  const list = transform
    ? (rows as Record<string, unknown>[]).map(transform)
    : (rows as T[]);

  return {
    list,
    pageInfo: createPageInfo(totalCount, pagination),
  };
}

// ============================================================================
// Cursor-based Pagination
// ============================================================================

export interface CursorPaginationInput {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
}

export interface CursorPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface CursorPaginatedResult<T> {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: CursorPageInfo;
}

/**
 * Encode cursor from row ID
 */
export function encodeCursor(id: string | number): string {
  return Buffer.from(String(id)).toString('base64');
}

/**
 * Decode cursor to row ID
 */
export function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Apply cursor-based pagination to a query
 */
export async function cursorPaginatedQuery<T extends { id: string }>(
  db: Knex,
  table: string,
  input: CursorPaginationInput,
  condition?: Record<string, unknown>
): Promise<CursorPaginatedResult<T>> {
  const { cursor, limit = 25, direction = 'forward' } = input;
  const actualLimit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limit));

  let query = db(table);

  if (condition) {
    query = query.where(condition);
  }

  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    if (direction === 'forward') {
      query = query.where('id', '>', decodedCursor);
    } else {
      query = query.where('id', '<', decodedCursor);
    }
  }

  // Fetch one extra to determine if there are more results
  query = query.orderBy('id', direction === 'forward' ? 'asc' : 'desc');
  query = query.limit(actualLimit + 1);

  const rows = await query as T[];

  const hasMore = rows.length > actualLimit;
  if (hasMore) {
    rows.pop(); // Remove the extra row
  }

  if (direction === 'backward') {
    rows.reverse();
  }

  const edges = rows.map(row => ({
    node: row,
    cursor: encodeCursor(row.id),
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage: direction === 'forward' ? hasMore : !!cursor,
      hasPreviousPage: direction === 'forward' ? !!cursor : hasMore,
      startCursor: edges.length > 0 ? edges[0].cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    },
  };
}

export default {
  parsePaginationOptions,
  parseSortOptions,
  createPageInfo,
  applyPagination,
  applySort,
  getCount,
  paginatedQuery,
  encodeCursor,
  decodeCursor,
  cursorPaginatedQuery,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
