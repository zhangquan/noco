/**
 * Public (Shared View) Handlers
 * HTTP handlers for public/anonymous access
 * @module rest-api/handlers/public
 */

import type { Response } from 'express';
import type { ApiRequest, RawListQuery } from '../types';
import { RecordService } from '../services';
import { parseListParams, ok, created } from '../utils';
import { handler, BadRequestError, NotFoundError, ForbiddenError } from '../middleware';

/**
 * Shared view configuration
 */
interface SharedViewConfig {
  tableId: string;
  viewId: string;
  allowedOperations: ('read' | 'create')[];
}

/**
 * Resolve shared view configuration
 * In production, this would look up from database
 */
async function resolveSharedView(
  req: ApiRequest,
  viewId: string
): Promise<SharedViewConfig> {
  const { tables } = req.context;

  if (!tables || tables.length === 0) {
    throw new NotFoundError('Tables not configured');
  }

  // Try to find a table that matches (placeholder implementation)
  const table = tables.find((t: { id: string; title: string }) => t.id === viewId || t.title === viewId);

  if (!table) {
    throw new NotFoundError(
      `Shared view '${viewId}' not found or has expired`
    );
  }

  return {
    tableId: table.id,
    viewId,
    allowedOperations: ['read', 'create'],
  };
}

/**
 * Check if operation is allowed
 */
function checkOperation(
  config: SharedViewConfig,
  operation: 'read' | 'create'
): void {
  if (!config.allowedOperations.includes(operation)) {
    throw new ForbiddenError(
      `Operation '${operation}' is not allowed for this shared view`
    );
  }
}

/**
 * Prepare context for shared view operations
 */
async function prepareSharedContext(
  req: ApiRequest,
  operation: 'read' | 'create'
): Promise<void> {
  const { viewId } = req.params;

  if (!viewId) {
    throw new BadRequestError('Shared view ID is required');
  }

  const config = await resolveSharedView(req, viewId);
  checkOperation(config, operation);

  // Update context with resolved table
  const table = req.context.tables.find((t: { id: string }) => t.id === config.tableId);
  if (table) {
    req.context.table = table;
    req.context.tableId = table.id;
    req.context.viewId = config.viewId;
  }
}

/**
 * GET /shared/:viewId - List records
 */
export const listRecords = handler(async (req: ApiRequest, res: Response) => {
  await prepareSharedContext(req, 'read');

  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const result = await service.list(params);
  ok(res, result);
});

/**
 * POST /shared/:viewId - Create record (form submission)
 */
export const createRecord = handler(async (req: ApiRequest, res: Response) => {
  await prepareSharedContext(req, 'create');

  if (!req.body || typeof req.body !== 'object') {
    throw new BadRequestError('Request body is required');
  }

  const service = new RecordService(req.context);
  const record = await service.create(req.body);
  created(res, record);
});

/**
 * GET /shared/:viewId/:rowId - Get single record
 */
export const getRecord = handler(async (req: ApiRequest, res: Response) => {
  await prepareSharedContext(req, 'read');

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
 * GET /shared/:viewId/find-one - Find single record
 */
export const findOne = handler(async (req: ApiRequest, res: Response) => {
  await prepareSharedContext(req, 'read');

  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const record = await service.findOne(params);
  ok(res, record);
});

/**
 * GET /shared/:viewId/count - Get record count
 */
export const count = handler(async (req: ApiRequest, res: Response) => {
  await prepareSharedContext(req, 'read');

  const service = new RecordService(req.context);
  const params = parseListParams(req.query as RawListQuery);
  const count = await service.count(params);
  ok(res, { count });
});
