/**
 * REST API Helper Functions
 * @module rest-api/helpers
 */

import type { Response } from 'express';
import type { Knex } from 'knex';
import type { Table, Column, Filter, Sort, ListArgs, DataRecord } from '../types';
import { UITypes, getColumnName } from '../types';
import { ModelError, ErrorCode } from '../core/NcError';
import { getColumnsWithPk } from '../utils/columnUtils';
import { createModel, createLazyModel } from '../models/Model';
import type {
  AgentRequest,
  ParsedRequestContext,
  PagedResponse,
  ListQueryParams,
  TableRouteParams,
  RestApiConfig,
  DEFAULT_REST_API_CONFIG,
} from './types';

// ============================================================================
// Request Parsing Helpers
// ============================================================================

/**
 * Get table and model context from request
 * Resolves table by ID or name from route params
 */
export function getTableFromRequest(
  req: AgentRequest,
  params?: TableRouteParams
): ParsedRequestContext {
  const { db, tables, user } = req;
  
  if (!db) {
    throw new ModelError('Database not configured', ErrorCode.INTERNAL_SERVER_ERROR);
  }
  if (!tables || tables.length === 0) {
    throw new ModelError('Tables not configured', ErrorCode.INTERNAL_SERVER_ERROR);
  }

  const tableName = params?.tableName || req.params.tableName;
  if (!tableName) {
    throw new ModelError('Table name is required', ErrorCode.BAD_REQUEST);
  }

  // Find table by ID or title
  const table = tables.find(
    (t) => t.id === tableName || t.title === tableName || t.name === tableName
  );

  if (!table) {
    throw new ModelError(`Table '${tableName}' not found`, ErrorCode.NOT_FOUND);
  }

  const viewId = req.params.viewName;

  return {
    db,
    tables,
    table,
    tableId: table.id,
    viewId,
    user,
    reqContext: {
      user: user ? { id: user.id, email: user.email, display_name: user.display_name } : undefined,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    },
  };
}

/**
 * Create a model instance from request context
 */
export function createModelFromRequest(
  ctx: ParsedRequestContext,
  options: { lazyLoading?: boolean } = {}
): ReturnType<typeof createModel> {
  const factory = options.lazyLoading ? createLazyModel : createModel;
  
  return factory({
    db: ctx.db,
    tableId: ctx.tableId,
    tables: ctx.tables,
    viewId: ctx.viewId,
  });
}

// ============================================================================
// Query Parameter Parsing
// ============================================================================

/**
 * Parse list query parameters into ListArgs
 */
export function parseListArgs(query: ListQueryParams, config?: Partial<RestApiConfig>): ListArgs {
  const defaultPageSize = config?.defaultPageSize || 25;
  const maxPageSize = config?.maxPageSize || 1000;

  const args: ListArgs = {};

  // Parse pagination
  if (query.offset !== undefined) {
    args.offset = Math.max(0, parseInt(query.offset, 10) || 0);
  }
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10) || defaultPageSize;
    args.limit = Math.min(Math.max(1, limit), maxPageSize);
  } else {
    args.limit = defaultPageSize;
  }

  // Parse fields
  if (query.fields) {
    args.fields = Array.isArray(query.fields) 
      ? query.fields 
      : query.fields.split(',').map((f) => f.trim());
  }

  // Parse legacy where
  if (query.where) {
    args.where = query.where;
  }

  // Parse legacy sort
  if (query.sort) {
    args.sort = query.sort;
  }

  // Parse JSON filter array
  if (query.filterArrJson) {
    try {
      args.filterArr = JSON.parse(query.filterArrJson) as Filter[];
    } catch {
      throw new ModelError('Invalid filterArrJson format', ErrorCode.BAD_REQUEST);
    }
  }

  // Parse JSON sort array
  if (query.sortArrJson) {
    try {
      args.sortArr = JSON.parse(query.sortArrJson) as Sort[];
    } catch {
      throw new ModelError('Invalid sortArrJson format', ErrorCode.BAD_REQUEST);
    }
  }

  // Parse simplified filter (AI-friendly)
  if (query.filter) {
    try {
      args.filter = typeof query.filter === 'string' 
        ? JSON.parse(query.filter) 
        : query.filter;
    } catch {
      throw new ModelError('Invalid filter format', ErrorCode.BAD_REQUEST);
    }
  }

  // Parse simplified sortBy (AI-friendly)
  if (query.sortBy) {
    try {
      args.sortBy = typeof query.sortBy === 'string' 
        ? JSON.parse(query.sortBy) 
        : query.sortBy;
    } catch {
      throw new ModelError('Invalid sortBy format', ErrorCode.BAD_REQUEST);
    }
  }

  return args;
}

/**
 * Parse row IDs from request body or query
 */
export function parseRowIds(req: AgentRequest): string[] {
  // From body (array of objects with id, or array of strings)
  if (Array.isArray(req.body)) {
    return req.body.map((item) => 
      typeof item === 'string' ? item : (item.id || item.Id)
    ).filter(Boolean);
  }

  // From query (comma-separated)
  if (req.query.ids) {
    const ids = req.query.ids as string;
    return ids.split(',').map((id) => id.trim()).filter(Boolean);
  }

  return [];
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a paged response
 */
export function createPagedResponse<T = DataRecord>(
  list: T[],
  totalRows: number,
  offset: number = 0,
  limit: number = 25
): PagedResponse<T> {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalRows / limit);

  return {
    list,
    pageInfo: {
      totalRows,
      page,
      pageSize: limit,
      isFirstPage: page === 1,
      isLastPage: page >= totalPages || list.length < limit,
    },
  };
}

/**
 * Send success response
 */
export function sendSuccess(res: Response, data: unknown, statusCode: number = 200): void {
  res.status(statusCode).json(data);
}

/**
 * Send error response
 */
export function sendError(res: Response, error: ModelError | Error): void {
  if (error instanceof ModelError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        statusCode: error.statusCode,
      },
    });
  } else {
    res.status(500).json({
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error.message || 'Internal server error',
        statusCode: 500,
      },
    });
  }
}

// ============================================================================
// Column Helpers
// ============================================================================

/**
 * Get column by ID or name from table
 */
export function getColumnByIdOrName(
  table: Table,
  columnIdOrName: string
): Column | undefined {
  const columns = getColumnsWithPk(table);
  
  return columns.find(
    (c) =>
      c.id === columnIdOrName ||
      c.title === columnIdOrName ||
      getColumnName(c) === columnIdOrName
  );
}

/**
 * Get link column by ID or name
 */
export function getLinkColumn(
  table: Table,
  columnIdOrName: string
): Column | undefined {
  const column = getColumnByIdOrName(table, columnIdOrName);
  
  if (!column) return undefined;
  
  if (column.uidt !== UITypes.Links && column.uidt !== UITypes.LinkToAnotherRecord) {
    return undefined;
  }
  
  return column;
}

/**
 * Get columns for export (filter out virtual columns by default)
 */
export function getExportColumns(
  table: Table,
  requestedFields?: string | string[]
): Column[] {
  const columns = getColumnsWithPk(table);
  
  if (!requestedFields) {
    // Return all non-virtual columns
    return columns.filter((c) => {
      const uidt = c.uidt as UITypes;
      return ![
        UITypes.Formula,
        UITypes.Rollup,
        UITypes.Lookup,
        UITypes.Links,
        UITypes.LinkToAnotherRecord,
      ].includes(uidt);
    });
  }

  const fields = Array.isArray(requestedFields)
    ? requestedFields
    : requestedFields.split(',').map((f) => f.trim());

  return columns.filter((c) =>
    fields.includes(c.id) || fields.includes(c.title) || fields.includes(getColumnName(c))
  );
}

// ============================================================================
// Data Serialization Helpers
// ============================================================================

/**
 * Serialize a cell value for export
 */
export function serializeCellValue(
  value: unknown,
  column: Column
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  const uidt = column.uidt as UITypes;

  switch (uidt) {
    case UITypes.Attachment:
    case UITypes.JSON:
      // Stringify complex types
      return typeof value === 'string' ? value : JSON.stringify(value);

    case UITypes.MultiSelect:
      // Join array values
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    case UITypes.Checkbox:
      return Boolean(value);

    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.AutoNumber:
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      }
      return null;

    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      // Extract display name or email from user object
      if (typeof value === 'object' && value !== null) {
        return (value as Record<string, unknown>).display_name as string ||
               (value as Record<string, unknown>).email as string ||
               (value as Record<string, unknown>).id as string ||
               JSON.stringify(value);
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Extract CSV data from records
 */
export function extractCsvData(
  records: DataRecord[],
  columns: Column[]
): string {
  const headers = columns.map((c) => c.title || getColumnName(c));
  const rows = records.map((record) =>
    columns.map((col) => {
      const key = getColumnName(col);
      const value = (record as { [key: string]: unknown })[key] ?? (record as { [key: string]: unknown })[col.id] ?? (record as { [key: string]: unknown })[col.title];
      const serialized = serializeCellValue(value, col);
      
      // Escape CSV values
      if (serialized === null) return '';
      if (typeof serialized === 'string') {
        if (serialized.includes(',') || serialized.includes('"') || serialized.includes('\n')) {
          return `"${serialized.replace(/"/g, '""')}"`;
        }
        return serialized;
      }
      return String(serialized);
    })
  );

  const headerRow = headers.map((h) => {
    if (h.includes(',') || h.includes('"')) {
      return `"${h.replace(/"/g, '""')}"`;
    }
    return h;
  }).join(',');

  const dataRows = rows.map((row) => row.join(','));

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Extract data for XLSX export (returns array of arrays)
 */
export function extractXlsxData(
  records: DataRecord[],
  columns: Column[]
): Array<Array<string | number | boolean | null>> {
  const headers = columns.map((c) => c.title || getColumnName(c));
  const rows = records.map((record) =>
    columns.map((col) => {
      const key = getColumnName(col);
      const value = (record as { [key: string]: unknown })[key] ?? (record as { [key: string]: unknown })[col.id] ?? (record as { [key: string]: unknown })[col.title];
      return serializeCellValue(value, col);
    })
  );

  return [headers, ...rows];
}

// ============================================================================
// Batch Processing Helpers
// ============================================================================

/**
 * Get database rows in batches with timeout control
 */
export async function getDbRows<T = DataRecord>(
  fetchFn: (offset: number, limit: number) => Promise<T[]>,
  options: {
    batchSize?: number;
    maxRows?: number;
    timeoutMs?: number;
  } = {}
): Promise<T[]> {
  const { batchSize = 100, maxRows = 10000, timeoutMs = 30000 } = options;
  
  const startTime = Date.now();
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      break;
    }

    // Check max rows
    if (allRows.length >= maxRows) {
      break;
    }

    const limit = Math.min(batchSize, maxRows - allRows.length);
    const batch = await fetchFn(offset, limit);

    if (batch.length === 0) {
      break;
    }

    allRows.push(...batch);
    offset += batch.length;

    // If we got less than requested, we've reached the end
    if (batch.length < limit) {
      break;
    }
  }

  return allRows;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate row ID format
 */
export function validateRowId(rowId: string): void {
  if (!rowId || typeof rowId !== 'string') {
    throw new ModelError('Invalid row ID', ErrorCode.BAD_REQUEST);
  }
  
  // ULID format validation (26 characters, alphanumeric)
  if (!/^[0-9A-Z]{26}$/i.test(rowId)) {
    throw new ModelError('Invalid row ID format', ErrorCode.BAD_REQUEST);
  }
}

/**
 * Validate relation type
 */
export function validateRelationType(type: string): 'mm' | 'hm' | 'bt' {
  const validTypes = ['mm', 'hm', 'bt'];
  if (!validTypes.includes(type)) {
    throw new ModelError(
      `Invalid relation type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      ErrorCode.BAD_REQUEST
    );
  }
  return type as 'mm' | 'hm' | 'bt';
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

/**
 * Wrap async handler with error handling
 */
export function catchError(handler: Function): Function {
  return async (req: AgentRequest, res: Response, next: Function) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ModelError) {
        sendError(res, error);
      } else {
        console.error('Unhandled error:', error);
        sendError(res, error as Error);
      }
    }
  };
}
