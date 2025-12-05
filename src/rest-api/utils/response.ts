/**
 * Response Builder Utilities
 * @module rest-api/utils/response
 */

import type { Response } from 'express';
import type {
  PageInfo,
  PagedResponse,
  BulkResult,
  BulkError,
} from '../types';

/**
 * Send 200 OK response
 */
export function ok<T>(res: Response, data: T): void {
  res.status(200).json(data);
}

/**
 * Send 201 Created response
 */
export function created<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

/**
 * Send 204 No Content response
 */
export function noContent(res: Response): void {
  res.status(204).end();
}

/**
 * Build page info from pagination parameters
 *
 * @param total - Total number of records
 * @param offset - Current offset
 * @param limit - Page size
 * @returns Page info object
 */
export function buildPageInfo(
  total: number,
  offset: number = 0,
  limit: number = 25
): PageInfo {
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

/**
 * Build paginated response
 *
 * @param list - List of records
 * @param total - Total count
 * @param offset - Current offset
 * @param limit - Page size
 * @returns Paginated response
 */
export function paginate<T>(
  list: T[],
  total: number,
  offset: number = 0,
  limit: number = 25
): PagedResponse<T> {
  return {
    list,
    pageInfo: buildPageInfo(total, offset, limit),
  };
}

/**
 * Build bulk operation result
 *
 * @param affected - Number of affected records
 * @param ids - IDs of affected records
 * @param errors - Errors if any
 * @returns Bulk result object
 */
export function bulkResult(
  affected: number,
  ids?: string[],
  errors?: BulkError[]
): BulkResult {
  return {
    success: !errors || errors.length === 0,
    affected,
    ids,
    errors: errors && errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send file download response
 *
 * @param res - Express response
 * @param filename - Download filename
 * @param data - File content
 * @param contentType - MIME type
 */
export function download(
  res: Response,
  filename: string,
  data: string | Buffer,
  contentType: string
): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
}

/**
 * Send CSV download response
 */
export function downloadCsv(
  res: Response,
  filename: string,
  data: string
): void {
  download(res, filename, data, 'text/csv; charset=utf-8');
}

/**
 * Send JSON export response (for XLSX data)
 */
export function sendExportJson(
  res: Response,
  filename: string,
  columns: string[],
  rows: unknown[][],
  format: 'xlsx' | 'csv' = 'xlsx'
): void {
  res.json({
    filename,
    format,
    columns,
    rows,
    totalRows: rows.length,
  });
}
