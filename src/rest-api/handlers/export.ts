/**
 * Export Handlers
 * HTTP handlers for data export operations
 * @module rest-api/handlers/export
 */

import type { Response, NextFunction } from 'express';
import type { ApiRequest, RawListQuery } from '../types';
import { ExportService } from '../services';
import { parseListParams, parseFields, downloadCsv, sendExportJson } from '../utils';
import { handler, BadRequestError } from '../middleware';

/**
 * Internal helper for CSV export
 */
async function doExportCsv(req: ApiRequest, res: Response): Promise<void> {
  const service = new ExportService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const fields = parseFields(req.query.fields as string | string[]);

  const result = await service.exportCsv(params, fields);
  downloadCsv(res, result.filename, result.data);
}

/**
 * Internal helper for XLSX export
 */
async function doExportXlsx(req: ApiRequest, res: Response): Promise<void> {
  const service = new ExportService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const fields = parseFields(req.query.fields as string | string[]);

  const result = await service.exportXlsx(params, fields);
  sendExportJson(res, result.filename, result.columns!, result.rows!, 'xlsx');
}

/**
 * GET /:tableName/export - Export with format query param
 */
export const exportData = handler(async (req: ApiRequest, res: Response, next: NextFunction) => {
  const format = ((req.query.format as string) || 'csv').toLowerCase();

  if (format === 'csv') {
    await doExportCsv(req, res);
  } else if (format === 'xlsx' || format === 'excel') {
    await doExportXlsx(req, res);
  } else {
    throw new BadRequestError(
      `Unsupported export format: ${format}. Supported: csv, xlsx`
    );
  }
});

/**
 * GET /:tableName/export/csv - Export as CSV
 */
export const exportCsv = handler(async (req: ApiRequest, res: Response, next: NextFunction) => {
  await doExportCsv(req, res);
});

/**
 * GET /:tableName/export/xlsx - Export as Excel
 */
export const exportXlsx = handler(async (req: ApiRequest, res: Response, next: NextFunction) => {
  await doExportXlsx(req, res);
});

/**
 * GET /:tableName/export/:format - Export with format in path
 */
export const exportAs = handler(async (req: ApiRequest, res: Response, next: NextFunction) => {
  const format = (req.params.format || 'csv').toLowerCase();

  if (format === 'csv') {
    await doExportCsv(req, res);
  } else if (format === 'xlsx' || format === 'excel') {
    await doExportXlsx(req, res);
  } else {
    throw new BadRequestError(
      `Unsupported export format: ${format}. Supported: csv, xlsx`
    );
  }
});

/**
 * POST /:tableName/export - Export with options in body
 */
export const exportWithOptions = handler(async (req: ApiRequest, res: Response, next: NextFunction) => {
  const { format = 'csv', fields, filters, sorts } = req.body || {};

  // Merge body options into query
  if (fields) {
    req.query.fields = Array.isArray(fields) ? fields.join(',') : fields;
  }
  if (filters) {
    req.query.filter = JSON.stringify(filters);
  }
  if (sorts) {
    req.query.sortBy = JSON.stringify(sorts);
  }

  const normalizedFormat = (format as string).toLowerCase();

  if (normalizedFormat === 'csv') {
    await doExportCsv(req, res);
  } else if (normalizedFormat === 'xlsx' || normalizedFormat === 'excel') {
    await doExportXlsx(req, res);
  } else {
    throw new BadRequestError(
      `Unsupported export format: ${format}. Supported: csv, xlsx`
    );
  }
});
