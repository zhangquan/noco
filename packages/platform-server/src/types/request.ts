/**
 * Request Context Type Definitions
 * @module types/request
 */

import type { Request } from 'express';
import type { Knex } from 'knex';
import type { User } from './entities.js';

// ============================================================================
// JWT Types
// ============================================================================

/**
 * JWT token payload
 */
export interface JwtPayload {
  id: string;
  email: string;
  roles?: string;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Request Context Types
// ============================================================================

/**
 * Request context for API handlers
 */
export interface RequestContext {
  /** Authenticated user */
  user?: User;
  /** Current project ID */
  projectId?: string;
  /** Current base/database ID */
  baseId?: string;
  /** Database transaction (optional) */
  trx?: Knex.Transaction;
}

/**
 * Extended Express Request with context
 */
export interface ApiRequest extends Request {
  /** Authenticated user */
  user?: User;
  /** Request context */
  context?: RequestContext;
  /** Project ID from route */
  ncProjectId?: string;
  /** Base ID from route */
  ncBaseId?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API success response
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  list: T[];
  pageInfo: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Common list query parameters
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

/**
 * Parsed list query options
 */
export interface ListOptions {
  offset: number;
  limit: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  search?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse list query parameters into options
 */
export function parseListQuery(query: ListQueryParams): ListOptions {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  
  const options: ListOptions = {
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };

  if (query.sort) {
    options.orderBy = {
      [query.sort]: query.order || 'asc',
    };
  }

  if (query.search) {
    options.search = query.search;
  }

  return options;
}

/**
 * Build page info for paginated response
 */
export function buildPageInfo(
  total: number,
  offset: number,
  limit: number
): PaginatedResponse<unknown>['pageInfo'] {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    pageSize: limit,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
