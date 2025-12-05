/**
 * Bulk Operation Handlers
 * HTTP handlers for batch operations
 * @module rest-api/handlers/bulk
 */

import type { Response } from 'express';
import type { RawListQuery } from '../types';
import type { ApiRequest, DataRecord } from '../types';
import { BulkService } from '../services';
import { parseListParams, parseRowIds, ok, created } from '../utils';
import { handler, BadRequestError } from '../middleware';

/**
 * POST /bulk/:tableName - Bulk insert
 */
export const bulkCreate = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const result = await service.bulkCreate(req.body);
  created(res, result);
});

/**
 * PATCH /bulk/:tableName - Bulk update by IDs
 */
export const bulkUpdate = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const result = await service.bulkUpdate(req.body);
  ok(res, result);
});

/**
 * PATCH /bulk/:tableName/all - Bulk update all matching
 */
export const bulkUpdateAll = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const result = await service.bulkUpdateAll(params, req.body);
  ok(res, result);
});

/**
 * DELETE /bulk/:tableName - Bulk delete by IDs
 */
export const bulkDelete = handler(async (req: ApiRequest, res: Response) => {
  // IDs can come from body (array) or query (comma-separated)
  let ids: string[];

  if (Array.isArray(req.body)) {
    ids = req.body
      .map((item: unknown) =>
        typeof item === 'string'
          ? item
          : (item as Record<string, unknown>)?.id as string || (item as Record<string, unknown>)?.Id as string
      )
      .filter((id: string | undefined): id is string => Boolean(id));
  } else {
    ids = parseRowIds(req.body, req.query.ids as string);
  }

  if (ids.length === 0) {
    throw new BadRequestError('IDs are required for bulk delete');
  }

  const service = new BulkService(req.context);
  const result = await service.bulkDelete(ids);
  ok(res, result);
});

/**
 * DELETE /bulk/:tableName/all - Bulk delete all matching
 */
export const bulkDeleteAll = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const result = await service.bulkDeleteAll(params);
  ok(res, result);
});

/**
 * DELETE /bulk/:tableName/truncate - Truncate table
 */
export const truncate = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const result = await service.truncate();
  ok(res, result);
});

/**
 * POST /bulk/:tableName/write - Mixed bulk write
 */
export const bulkWrite = handler(async (req: ApiRequest, res: Response) => {
  const service = new BulkService(req.context);
  const result = await service.bulkWrite(req.body);
  ok(res, result);
});
