/**
 * Record Handlers
 * HTTP handlers for single record operations
 * @module rest-api/handlers/records
 */

import type { Response, NextFunction } from 'express';
import type { ApiRequest, RawListQuery, RawGroupByQuery } from '../types';
import { RecordService } from '../services';
import { parseListParams, parseGroupByParams, ok, created } from '../utils';
import { handler, BadRequestError, NotFoundError } from '../middleware';

/**
 * GET /tables - List all tables
 */
export const listTables = handler(async (req: ApiRequest, res: Response) => {
  const { tables } = req.context;

  if (!tables || tables.length === 0) {
    throw new NotFoundError('No tables configured');
  }

  // Use first table to get model for describeAllTables
  const service = new RecordService({
    ...req.context,
    tableId: tables[0].id,
    table: tables[0],
  });

  const overview = service.describeAllTables();
  ok(res, overview);
});

/**
 * GET /:tableName - List records
 */
export const listRecords = handler(async (req: ApiRequest, res: Response) => {
  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);

  const result = await service.list(params);
  ok(res, result);
});

/**
 * POST /:tableName - Create record
 */
export const createRecord = handler(async (req: ApiRequest, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new BadRequestError('Request body is required');
  }

  const service = new RecordService(req.context);
  const record = await service.create(req.body);
  created(res, record);
});

/**
 * GET /:tableName/:rowId - Get single record
 */
export const getRecord = handler(async (req: ApiRequest, res: Response) => {
  const { rowId } = req.params;
  const fields = req.query.fields as string | undefined;

  const service = new RecordService(req.context);
  const record = await service.getById(
    rowId,
    fields ? fields.split(',').map((f) => f.trim()) : undefined
  );
  ok(res, record);
});

/**
 * PATCH /:tableName/:rowId - Update record
 */
export const updateRecord = handler(async (req: ApiRequest, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new BadRequestError('Request body is required');
  }

  const { rowId } = req.params;

  const service = new RecordService(req.context);
  const record = await service.update(rowId, req.body);
  ok(res, record);
});

/**
 * DELETE /:tableName/:rowId - Delete record
 */
export const deleteRecord = handler(async (req: ApiRequest, res: Response) => {
  const { rowId } = req.params;

  const service = new RecordService(req.context);
  await service.delete(rowId);
  ok(res, { deleted: true });
});

/**
 * GET /:tableName/:rowId/exists - Check if record exists
 */
export const checkExists = handler(async (req: ApiRequest, res: Response) => {
  const { rowId } = req.params;

  const service = new RecordService(req.context);
  const exists = await service.exists(rowId);
  ok(res, { exists });
});

/**
 * GET /:tableName/find-one - Find single record
 */
export const findOne = handler(async (req: ApiRequest, res: Response) => {
  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);

  const record = await service.findOne(params);
  ok(res, record);
});

/**
 * GET /:tableName/count - Get record count
 */
export const count = handler(async (req: ApiRequest, res: Response) => {
  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);

  const count = await service.count(params);
  ok(res, { count });
});

/**
 * GET /:tableName/groupby - Group by aggregation
 */
export const groupBy = handler(async (req: ApiRequest, res: Response) => {
  const service = new RecordService(req.context);
  const query = req.query as RawGroupByQuery;
  const columnId = req.params.columnId || query.column_name;

  if (!columnId) {
    throw new BadRequestError('Column name is required for groupby');
  }

  const params = parseGroupByParams(query, columnId);
  const result = await service.groupBy(
    params.columnId,
    params.aggregation || 'count',
    params
  );
  ok(res, result);
});

/**
 * GET /:tableName/schema - Get schema description
 */
export const describeSchema = handler(async (req: ApiRequest, res: Response) => {
  const service = new RecordService(req.context);
  const schema = service.describeSchema();
  ok(res, schema);
});
