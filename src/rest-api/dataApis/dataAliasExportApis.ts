/**
 * Data Export API Handlers (CSV/Excel)
 * @module rest-api/dataApis/dataAliasExportApis
 */

import type { Response, NextFunction, Router } from 'express';
import type { DataRecord, Column } from '../../types';
import { ModelError, ErrorCode } from '../../core/NcError';
import {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  getExportColumns,
  extractCsvData,
  extractXlsxData,
  getDbRows,
} from '../helpers';
import { asyncHandler, ncMetaAclMw, apiMetrics, type AsyncHandler } from '../middleware';
import type { AgentRequest, ExportQueryParams, RestApiConfig } from '../types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_EXPORT_CONFIG = {
  maxExportRows: 10000,
  exportTimeout: 30000,
  batchSize: 100,
};

// ============================================================================
// Core Business Functions (Reusable)
// ============================================================================

/**
 * Export data as CSV
 */
export async function exportCsvFun(
  req: AgentRequest,
  options: Partial<typeof DEFAULT_EXPORT_CONFIG> = {}
): Promise<{ filename: string; data: string; contentType: string }> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  
  const query = req.query as ExportQueryParams;
  const columns = getExportColumns(ctx.table, query.fields);
  
  const config = { ...DEFAULT_EXPORT_CONFIG, ...options };
  
  // Parse list args for filtering
  const args = parseListArgs(req.query as { [key: string]: string });
  
  // Fetch data in batches with timeout control
  const records = await getDbRows<DataRecord>(
    async (offset, limit) => {
      return model.list({ ...args, offset, limit, fields: columns.map((c) => c.id) });
    },
    {
      batchSize: config.batchSize,
      maxRows: config.maxExportRows,
      timeoutMs: config.exportTimeout,
    }
  );
  
  const csvData = extractCsvData(records, columns);
  const filename = `${ctx.table.title || ctx.table.id}_${Date.now()}.csv`;
  
  return {
    filename,
    data: csvData,
    contentType: 'text/csv; charset=utf-8',
  };
}

/**
 * Export data as Excel (XLSX)
 * Returns data structure for XLSX generation
 * Note: Actual XLSX generation requires a library like xlsx or exceljs
 */
export async function exportXlsxFun(
  req: AgentRequest,
  options: Partial<typeof DEFAULT_EXPORT_CONFIG> = {}
): Promise<{ filename: string; data: Array<Array<unknown>>; contentType: string }> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  
  const query = req.query as ExportQueryParams;
  const columns = getExportColumns(ctx.table, query.fields);
  
  const config = { ...DEFAULT_EXPORT_CONFIG, ...options };
  
  // Parse list args for filtering
  const args = parseListArgs(req.query as { [key: string]: string });
  
  // Fetch data in batches with timeout control
  const records = await getDbRows<DataRecord>(
    async (offset, limit) => {
      return model.list({ ...args, offset, limit, fields: columns.map((c) => c.id) });
    },
    {
      batchSize: config.batchSize,
      maxRows: config.maxExportRows,
      timeoutMs: config.exportTimeout,
    }
  );
  
  const xlsxData = extractXlsxData(records, columns);
  const filename = `${ctx.table.title || ctx.table.id}_${Date.now()}.xlsx`;
  
  return {
    filename,
    data: xlsxData,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

/**
 * Export data with automatic format detection
 */
export async function exportDataFun(
  req: AgentRequest,
  format: 'csv' | 'xlsx' = 'csv',
  options: Partial<typeof DEFAULT_EXPORT_CONFIG> = {}
): Promise<{ filename: string; data: string | Array<Array<unknown>>; contentType: string }> {
  if (format === 'xlsx') {
    return exportXlsxFun(req, options);
  }
  return exportCsvFun(req, options);
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /:tableName/export/csv - Export table as CSV
 */
async function exportCsv(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await exportCsvFun(req);
  
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}

/**
 * GET /:tableName/views/:viewName/export/csv - Export view as CSV
 */
async function exportViewCsv(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // View name is already in params, view-specific filters would be applied
  const result = await exportCsvFun(req);
  
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
}

/**
 * GET /:tableName/export/excel - Export table as Excel
 */
async function exportExcel(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await exportXlsxFun(req);
  
  // For actual XLSX generation, you would use a library here
  // This returns JSON data that can be converted to XLSX by the client
  // or you can integrate xlsx/exceljs library
  res.setHeader('Content-Type', 'application/json');
  res.json({
    filename: result.filename,
    format: 'xlsx',
    columns: result.data[0], // Headers
    rows: result.data.slice(1), // Data rows
    totalRows: result.data.length - 1,
  });
}

/**
 * GET /:tableName/views/:viewName/export/excel - Export view as Excel
 */
async function exportViewExcel(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await exportXlsxFun(req);
  
  res.setHeader('Content-Type', 'application/json');
  res.json({
    filename: result.filename,
    format: 'xlsx',
    columns: result.data[0],
    rows: result.data.slice(1),
    totalRows: result.data.length - 1,
  });
}

/**
 * GET /:tableName/export - Export with format parameter
 */
async function exportData(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const format = (req.query.format as string) || 'csv';
  
  if (format === 'csv') {
    return exportCsv(req, res, next);
  } else if (format === 'xlsx' || format === 'excel') {
    return exportExcel(req, res, next);
  } else {
    throw new ModelError(
      `Unsupported export format: ${format}. Supported formats: csv, xlsx`,
      ErrorCode.BAD_REQUEST
    );
  }
}

/**
 * POST /:tableName/export - Export with custom options in body
 */
async function exportDataWithOptions(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { format = 'csv', fields, filters, sorts } = req.body || {};
  
  // Merge body options into query
  if (fields) {
    req.query.fields = Array.isArray(fields) ? fields.join(',') : fields;
  }
  if (filters) {
    req.query.filterArrJson = JSON.stringify(filters);
  }
  if (sorts) {
    req.query.sortArrJson = JSON.stringify(sorts);
  }
  
  if (format === 'csv') {
    return exportCsv(req, res, next);
  } else if (format === 'xlsx' || format === 'excel') {
    return exportExcel(req, res, next);
  } else {
    throw new ModelError(
      `Unsupported export format: ${format}`,
      ErrorCode.BAD_REQUEST
    );
  }
}

// ============================================================================
// Router Registration
// ============================================================================

/**
 * Register export API routes
 * 
 * Routes:
 * - GET  /:tableName/export/csv                 - Export table as CSV
 * - GET  /:tableName/export/excel               - Export table as Excel
 * - GET  /:tableName/export                     - Export with format param
 * - POST /:tableName/export                     - Export with options in body
 * - GET  /:tableName/views/:viewName/export/csv   - Export view as CSV
 * - GET  /:tableName/views/:viewName/export/excel - Export view as Excel
 */
export function addExportDataAliasRoutes(router: Router): void {
  // Table exports
  router.get(
    '/:tableName/export/csv',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportCsv), 'exportCsv', { action: 'export' })
  );

  router.get(
    '/:tableName/export/excel',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportExcel), 'exportExcel', { action: 'export' })
  );

  router.get(
    '/:tableName/export',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportData), 'exportData', { action: 'export' })
  );

  router.post(
    '/:tableName/export',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportDataWithOptions), 'exportDataWithOptions', { action: 'export' })
  );

  // View exports
  router.get(
    '/:tableName/views/:viewName/export/csv',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportViewCsv), 'exportViewCsv', { action: 'export' })
  );

  router.get(
    '/:tableName/views/:viewName/export/excel',
    apiMetrics,
    ncMetaAclMw(asyncHandler(exportViewExcel), 'exportViewExcel', { action: 'export' })
  );
}

export default addExportDataAliasRoutes;
