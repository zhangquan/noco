/**
 * Standardized API Response Utilities
 * Provides consistent response format across all APIs
 * @module utils/response
 */

import type { Response } from 'express';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard successful response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/**
 * Standard list response structure
 */
export interface ListResponse<T = unknown> {
  success: true;
  data: T[];
  meta: ListMeta;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * List response metadata with pagination
 */
export interface ListMeta extends ResponseMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Standard error response structure
 */
export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ResponseMeta;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
}

// ============================================================================
// Response Builder Class
// ============================================================================

/**
 * Fluent response builder for consistent API responses
 */
export class ApiResponse<T = unknown> {
  private statusCode: number = 200;
  private responseData: T | undefined;
  private responseMeta: ResponseMeta = {};
  private res: Response;

  constructor(res: Response) {
    this.res = res;
  }

  /**
   * Set HTTP status code
   */
  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  /**
   * Set response data
   */
  data(data: T): this {
    this.responseData = data;
    return this;
  }

  /**
   * Add metadata
   */
  meta(meta: ResponseMeta): this {
    this.responseMeta = { ...this.responseMeta, ...meta };
    return this;
  }

  /**
   * Send success response
   */
  send(): Response {
    const response: SuccessResponse<T> = {
      success: true,
      data: this.responseData as T,
    };

    if (Object.keys(this.responseMeta).length > 0) {
      response.meta = {
        ...this.responseMeta,
        timestamp: new Date().toISOString(),
      };
    }

    return this.res.status(this.statusCode).json(response);
  }

  /**
   * Send created response (201)
   */
  created(): Response {
    return this.status(201).send();
  }

  /**
   * Send no content response (204)
   */
  noContent(): Response {
    return this.res.status(204).send();
  }
}

// ============================================================================
// Response Helper Functions
// ============================================================================

/**
 * Create a new response builder
 */
export function apiResponse<T>(res: Response): ApiResponse<T> {
  return new ApiResponse<T>(res);
}

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ResponseMeta
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = {
      ...meta,
      timestamp: new Date().toISOString(),
    };
  }

  return res.status(statusCode).json(response);
}

/**
 * Send a list response with pagination
 */
export function sendList<T>(
  res: Response,
  data: T[],
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  },
  additionalMeta?: Omit<ResponseMeta, 'total' | 'page' | 'pageSize'>
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);
  const hasMore = pagination.page < totalPages;

  const response: ListResponse<T> = {
    success: true,
    data,
    meta: {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasMore,
      timestamp: new Date().toISOString(),
      ...additionalMeta,
    },
  };

  return res.status(200).json(response);
}

/**
 * Send a created response (201)
 */
export function sendCreated<T>(res: Response, data: T, meta?: ResponseMeta): Response {
  return sendSuccess(res, data, 201, meta);
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send an accepted response (202)
 */
export function sendAccepted<T>(res: Response, data?: T, meta?: ResponseMeta): Response {
  return sendSuccess(res, data, 202, meta);
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 25,
  maxPageSize: 100,
} as const;

/**
 * Parse pagination parameters from request query
 */
export function parsePagination(query: Record<string, unknown>): {
  page: number;
  pageSize: number;
  offset: number;
  limit: number;
} {
  const page = Math.max(1, parseInt(String(query.page || query.p || '1'), 10) || 1);
  let pageSize = parseInt(String(query.pageSize || query.limit || query.l || PAGINATION_DEFAULTS.pageSize), 10);
  
  // Clamp page size
  pageSize = Math.min(Math.max(1, pageSize || PAGINATION_DEFAULTS.pageSize), PAGINATION_DEFAULTS.maxPageSize);
  
  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  return { page, pageSize, offset, limit };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): Omit<ListMeta, 'requestId' | 'timestamp'> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if response is a success response
 */
export function isSuccessResponse<T>(response: unknown): response is SuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as SuccessResponse<T>).success === true
  );
}

/**
 * Check if response is an error response
 */
export function isErrorResponse(response: unknown): response is ErrorResponseBody {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    (response as ErrorResponseBody).success === false
  );
}

export default {
  apiResponse,
  sendSuccess,
  sendList,
  sendCreated,
  sendNoContent,
  sendAccepted,
  parsePagination,
  createPaginationMeta,
};
