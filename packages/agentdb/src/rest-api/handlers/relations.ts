/**
 * Relation Handlers
 * HTTP handlers for relationship operations
 * @module rest-api/handlers/relations
 */

import type { Response } from 'express';
import type { RawListQuery } from '../types';
import type { ApiRequest, DataRecord } from '../types';
import { RelationService } from '../services';
import { parseListParams, ok, created } from '../utils';
import { handler, BadRequestError } from '../middleware';

/**
 * Extract target IDs from request body
 */
function extractTargetIds(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body
      .map((item) =>
        typeof item === 'string'
          ? item
          : (item as DataRecord)?.id || (item as { Id?: string })?.Id
      )
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

/**
 * GET /:tableName/:rowId/links/:columnName - List linked records
 */
export const listLinked = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName } = req.params;

  const service = new RelationService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const result = await service.listLinked(rowId, columnName, params);
  ok(res, result);
});

/**
 * GET /:tableName/:rowId/links/:columnName/available - List available records
 */
export const listAvailable = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName } = req.params;

  const service = new RelationService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const result = await service.listAvailable(rowId, columnName, params);
  ok(res, result);
});

/**
 * GET /:tableName/:rowId/links/:columnName/one - Get single linked record
 */
export const getLinked = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName } = req.params;

  const service = new RelationService(req.context);
  const result = await service.getLinked(rowId, columnName);
  ok(res, result);
});

/**
 * POST /:tableName/:rowId/links/:columnName - Link records
 */
export const link = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName } = req.params;

  const targetIds = extractTargetIds(req.body);
  if (targetIds.length === 0) {
    throw new BadRequestError('Target record IDs are required');
  }

  const service = new RelationService(req.context);
  const result = await service.link(rowId, columnName, targetIds);
  created(res, result);
});

/**
 * DELETE /:tableName/:rowId/links/:columnName - Unlink records
 */
export const unlink = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName } = req.params;

  // IDs can come from body or query
  let targetIds: string[];

  if (Array.isArray(req.body) && req.body.length > 0) {
    targetIds = extractTargetIds(req.body);
  } else if (req.query.ids) {
    targetIds = (req.query.ids as string)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  } else {
    throw new BadRequestError('Target record IDs are required');
  }

  if (targetIds.length === 0) {
    throw new BadRequestError('Target record IDs are required');
  }

  const service = new RelationService(req.context);
  const result = await service.unlink(rowId, columnName, targetIds);
  ok(res, result);
});

/**
 * POST /:tableName/:rowId/links/:columnName/:targetId - Link single record
 */
export const linkOne = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName, targetId } = req.params;

  const service = new RelationService(req.context);
  const result = await service.linkOne(rowId, columnName, targetId);
  created(res, result);
});

/**
 * DELETE /:tableName/:rowId/links/:columnName/:targetId - Unlink single record
 */
export const unlinkOne = handler(async (req: ApiRequest, res: Response) => {
  const { rowId, columnName, targetId } = req.params;

  const service = new RelationService(req.context);
  const result = await service.unlinkOne(rowId, columnName, targetId);
  ok(res, result);
});
