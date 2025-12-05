/**
 * Bulk Data Operations API Handlers
 * @module rest-api/dataApis/bulkDataAliasApis
 */

import type { Response, NextFunction, Router } from 'express';
import type { DataRecord, ListArgs, BulkWriteOperation } from '../../types';
import { ModelError, ErrorCode } from '../../core/NcError';
import {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  parseRowIds,
  sendSuccess,
  getColumnByIdOrName,
} from '../helpers';
import { asyncHandler, ncMetaAclMw, apiMetrics, validateBody, type AsyncHandler } from '../middleware';
import type { AgentRequest, BulkOperationResponse } from '../types';

// ============================================================================
// Core Business Functions (Reusable)
// ============================================================================

/**
 * Bulk insert records
 */
export async function bulkInsertFun(
  req: AgentRequest,
  data: DataRecord[]
): Promise<BulkOperationResponse> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ModelError('Request body must be a non-empty array', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  const chunkSize = parseInt(req.query.chunkSize as string) || 100;
  
  const inserted = await model.bulkInsert(data, {
    chunkSize,
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: inserted.length,
    insertedIds: inserted.map((r) => r.id as string),
  };
}

/**
 * Bulk update records
 */
export async function bulkUpdateFun(
  req: AgentRequest,
  data: DataRecord[]
): Promise<BulkOperationResponse> {
  if (!Array.isArray(data) || data.length === 0) {
    throw new ModelError('Request body must be a non-empty array', ErrorCode.BAD_REQUEST);
  }

  // Validate that all records have IDs
  const invalidRecords = data.filter((r) => !r.id && !(r as { Id?: string }).Id);
  if (invalidRecords.length > 0) {
    throw new ModelError(
      'All records must have an id field for bulk update',
      ErrorCode.BAD_REQUEST
    );
  }

  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  const chunkSize = parseInt(req.query.chunkSize as string) || 100;
  
  const updated = await model.bulkUpdate(data, {
    chunkSize,
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: updated.length,
  };
}

/**
 * Bulk update all matching records
 */
export async function bulkUpdateAllFun(
  req: AgentRequest,
  updateData: DataRecord
): Promise<BulkOperationResponse> {
  if (!updateData || typeof updateData !== 'object') {
    throw new ModelError('Update data is required', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const args = parseListArgs(req.query as { [key: string]: string });

  const affectedRows = await model.bulkUpdateAll(args, updateData, {
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows,
  };
}

/**
 * Bulk delete records by IDs
 */
export async function bulkDeleteFun(
  req: AgentRequest,
  ids: string[]
): Promise<BulkOperationResponse> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ModelError('IDs array is required', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  const deleted = await model.bulkDelete(ids, {
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: deleted,
  };
}

/**
 * Bulk delete all matching records
 */
export async function bulkDeleteAllFun(
  req: AgentRequest
): Promise<BulkOperationResponse> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const args = parseListArgs(req.query as Record<string, string>);

  const deleted = await model.bulkDeleteAll(args, {
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: deleted,
  };
}

/**
 * Clear all data in table
 */
export async function clearAllDataFun(
  req: AgentRequest
): Promise<BulkOperationResponse> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  // Delete all without any filters
  const deleted = await model.bulkDeleteAll({}, {
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: deleted,
  };
}

/**
 * Clear all data in a specific column (set to null)
 */
export async function clearColumnDataFun(
  req: AgentRequest,
  columnId: string
): Promise<BulkOperationResponse> {
  const ctx = getTableFromRequest(req);
  const column = getColumnByIdOrName(ctx.table, columnId);
  
  if (!column) {
    throw new ModelError(`Column '${columnId}' not found`, ErrorCode.NOT_FOUND);
  }

  const model = createModelFromRequest(ctx);

  // Get all records and update the column to null
  const records = await model.list({ fields: ['id'] });
  const updateData = records.map((r) => ({
    id: r.id as string,
    [column.id]: null,
  }));

  if (updateData.length === 0) {
    return { success: true, affectedRows: 0 };
  }

  await model.bulkUpdate(updateData, {
    cookie: ctx.reqContext,
  });

  return {
    success: true,
    affectedRows: updateData.length,
  };
}

/**
 * Execute mixed bulk write operations atomically
 */
export async function bulkWriteFun(
  req: AgentRequest,
  operations: BulkWriteOperation[]
): Promise<unknown> {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new ModelError('Operations array is required', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  return model.bulkWrite(operations);
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /bulk/:tableName - Bulk insert
 */
async function bulkInsert(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await bulkInsertFun(req, req.body);
  sendSuccess(res, result, 201);
}

/**
 * PATCH /bulk/:tableName - Bulk update
 */
async function bulkUpdate(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await bulkUpdateFun(req, req.body);
  sendSuccess(res, result);
}

/**
 * PATCH /bulk/:tableName/all - Bulk update all matching
 */
async function bulkUpdateAll(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await bulkUpdateAllFun(req, req.body);
  sendSuccess(res, result);
}

/**
 * DELETE /bulk/:tableName - Bulk delete by IDs
 */
async function bulkDelete(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // IDs can come from body (array) or query (comma-separated)
  let ids: string[];
  
  if (Array.isArray(req.body)) {
    ids = req.body.map((item: unknown) =>
      typeof item === 'string' ? item : ((item as DataRecord).id || (item as { Id?: string }).Id)
    ).filter((id): id is string => Boolean(id));
  } else {
    ids = parseRowIds(req);
  }

  const result = await bulkDeleteFun(req, ids);
  sendSuccess(res, result);
}

/**
 * DELETE /bulk/:tableName/all - Bulk delete all matching
 */
async function bulkDeleteAll(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await bulkDeleteAllFun(req);
  sendSuccess(res, result);
}

/**
 * DELETE /bulk/:tableName/clearAll - Clear all table data
 */
async function clearAllData(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await clearAllDataFun(req);
  sendSuccess(res, result);
}

/**
 * DELETE /bulk/:tableName/:columnId/clearAll - Clear column data
 */
async function clearColumnData(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await clearColumnDataFun(req, req.params.columnId);
  sendSuccess(res, result);
}

/**
 * POST /bulk/:tableName/write - Mixed bulk write
 */
async function bulkWrite(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await bulkWriteFun(req, req.body);
  sendSuccess(res, result);
}

// ============================================================================
// Router Registration
// ============================================================================

/**
 * Register bulk data API routes
 * 
 * Routes:
 * - POST   /bulk/:tableName         - Bulk insert
 * - PATCH  /bulk/:tableName         - Bulk update
 * - PATCH  /bulk/:tableName/all     - Bulk update all matching
 * - DELETE /bulk/:tableName         - Bulk delete by IDs
 * - DELETE /bulk/:tableName/all     - Bulk delete all matching
 * - DELETE /bulk/:tableName/clearAll - Clear all table data
 * - DELETE /bulk/:tableName/:columnId/clearAll - Clear column data
 * - POST   /bulk/:tableName/write   - Mixed bulk write (atomic)
 */
export function addBulkDataAliasRoutes(router: Router): void {
  // Bulk insert
  router.post(
    '/bulk/:tableName',
    apiMetrics,
    validateBody({ required: true, type: 'array' }),
    ncMetaAclMw(asyncHandler(bulkInsert), 'bulkInsert', { action: 'bulkCreate' })
  );

  // Bulk update
  router.patch(
    '/bulk/:tableName',
    apiMetrics,
    validateBody({ required: true, type: 'array' }),
    ncMetaAclMw(asyncHandler(bulkUpdate), 'bulkUpdate', { action: 'bulkUpdate' })
  );

  // Bulk update all matching
  router.patch(
    '/bulk/:tableName/all',
    apiMetrics,
    validateBody({ required: true, type: 'object' }),
    ncMetaAclMw(asyncHandler(bulkUpdateAll), 'bulkUpdateAll', { action: 'bulkUpdate' })
  );

  // Mixed bulk write (atomic)
  router.post(
    '/bulk/:tableName/write',
    apiMetrics,
    validateBody({ required: true, type: 'array' }),
    ncMetaAclMw(asyncHandler(bulkWrite), 'bulkWrite', { action: 'bulkCreate' })
  );

  // Bulk delete by IDs
  router.delete(
    '/bulk/:tableName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(bulkDelete), 'bulkDelete', { action: 'bulkDelete' })
  );

  // Bulk delete all matching
  router.delete(
    '/bulk/:tableName/all',
    apiMetrics,
    ncMetaAclMw(asyncHandler(bulkDeleteAll), 'bulkDeleteAll', { action: 'bulkDelete' })
  );

  // Clear all table data
  router.delete(
    '/bulk/:tableName/clearAll',
    apiMetrics,
    ncMetaAclMw(asyncHandler(clearAllData), 'clearAllData', { action: 'bulkDelete' })
  );

  // Clear column data
  router.delete(
    '/bulk/:tableName/:columnId/clearAll',
    apiMetrics,
    ncMetaAclMw(asyncHandler(clearColumnData), 'clearColumnData', { action: 'bulkUpdate' })
  );
}

export default addBulkDataAliasRoutes;
