/**
 * Core Data CRUD API Handlers
 * @module rest-api/dataApis/dataAliasApis
 */

import type { Response, NextFunction, Router } from 'express';
import type { DataRecord, ListArgs, GroupByArgs } from '../../types';
import { ModelError, ErrorCode } from '../../core/NcError';
import {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  createPagedResponse,
  sendSuccess,
  validateRowId,
} from '../helpers';
import { asyncHandler, ncMetaAclMw, apiMetrics, type AsyncHandler } from '../middleware';
import type { AgentRequest, PagedResponse, GroupByQueryParams } from '../types';

// ============================================================================
// Core Business Functions (Reusable)
// ============================================================================

/**
 * Get data list with pagination
 */
export async function getDataList(
  req: AgentRequest,
  options: { lazyLoading?: boolean } = {}
): Promise<PagedResponse<DataRecord>> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx, options);
  const args = parseListArgs(req.query as { [key: string]: string });

  const [list, count] = await Promise.all([
    model.list(args),
    model.count(args),
  ]);

  return createPagedResponse(list, count, args.offset, args.limit);
}

/**
 * Get single record by primary key
 */
export async function dataRowRead(
  req: AgentRequest,
  rowId: string
): Promise<DataRecord> {
  validateRowId(rowId);
  
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const fields = req.query.fields as string | undefined;

  const record = await model.readByPk(rowId, fields);
  
  if (!record) {
    throw new ModelError(
      `Record '${rowId}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  return record;
}

/**
 * Find one record matching criteria
 */
export async function getFindOne(req: AgentRequest): Promise<DataRecord | null> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const args = parseListArgs(req.query as { [key: string]: string });

  return model.findOne(args);
}

/**
 * Insert new record
 */
export async function dataInsertFun(
  req: AgentRequest,
  data: DataRecord
): Promise<DataRecord> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  return model.insert(data, undefined, ctx.reqContext);
}

/**
 * Update record by primary key
 */
export async function dataUpdateFun(
  req: AgentRequest,
  rowId: string,
  data: DataRecord
): Promise<DataRecord> {
  validateRowId(rowId);
  
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  return model.updateByPk(rowId, data, undefined, ctx.reqContext);
}

/**
 * Delete record by primary key
 */
export async function dataDeleteFun(
  req: AgentRequest,
  rowId: string
): Promise<{ deleted: number }> {
  validateRowId(rowId);
  
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  const deleted = await model.deleteByPk(rowId, undefined, ctx.reqContext);
  
  return { deleted };
}

/**
 * Check if record exists
 */
export async function dataExistFun(
  req: AgentRequest,
  rowId: string
): Promise<{ exists: boolean }> {
  validateRowId(rowId);
  
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  const exists = await model.exists(rowId);
  
  return { exists };
}

/**
 * Get record count
 */
export async function getDataCount(req: AgentRequest): Promise<{ count: number }> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const args = parseListArgs(req.query as { [key: string]: string });

  const count = await model.count(args);
  
  return { count };
}

/**
 * Group by aggregation
 */
export async function getDataGroupBy(req: AgentRequest): Promise<DataRecord[]> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  
  const query = req.query as GroupByQueryParams;
  const columnId = query.column_name || req.params.columnId;
  
  if (!columnId) {
    throw new ModelError('Column name is required for groupby', ErrorCode.BAD_REQUEST);
  }

  const args: GroupByArgs = {
    ...parseListArgs(query),
    columnId,
    aggregation: query.aggregation || 'count',
  };

  return model.groupBy(args);
}

/**
 * Get schema description (AI-friendly)
 */
export async function getSchemaDescription(req: AgentRequest): Promise<unknown> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  return model.describeSchema();
}

/**
 * Get all tables overview (AI-friendly)
 */
export async function getAllTablesOverview(req: AgentRequest): Promise<unknown> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);

  return model.describeAllTables();
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /:tableName - List records
 */
async function dataList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await getDataList(req);
  sendSuccess(res, result);
}

/**
 * POST /:tableName - Create record
 */
async function dataCreate(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.body || typeof req.body !== 'object') {
    throw new ModelError('Request body is required', ErrorCode.BAD_REQUEST);
  }
  
  const record = await dataInsertFun(req, req.body);
  sendSuccess(res, record, 201);
}

/**
 * GET /:tableName/:rowId - Get single record
 */
async function dataRead(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const record = await dataRowRead(req, req.params.rowId);
  sendSuccess(res, record);
}

/**
 * PATCH /:tableName/:rowId - Update record
 */
async function dataUpdate(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.body || typeof req.body !== 'object') {
    throw new ModelError('Request body is required', ErrorCode.BAD_REQUEST);
  }
  
  const record = await dataUpdateFun(req, req.params.rowId, req.body);
  sendSuccess(res, record);
}

/**
 * DELETE /:tableName/:rowId - Delete record
 */
async function dataDelete(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await dataDeleteFun(req, req.params.rowId);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/find-one - Find single record
 */
async function dataFindOne(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const record = await getFindOne(req);
  sendSuccess(res, record);
}

/**
 * GET /:tableName/count - Get record count
 */
async function dataCount(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await getDataCount(req);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/:rowId/exist - Check if record exists
 */
async function dataExists(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await dataExistFun(req, req.params.rowId);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/groupby - Group by aggregation
 */
async function dataGroupBy(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await getDataGroupBy(req);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/groupby/:columnId - Group by specific column
 */
async function dataGroupByColumn(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await getDataGroupBy(req);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/views/:viewName - List records with view filters
 */
async function dataListWithView(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // View handling can apply additional filters/sorts from view config
  const result = await getDataList(req);
  sendSuccess(res, result);
}

/**
 * GET /:tableName/describe - Get schema description
 */
async function dataDescribe(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const schema = await getSchemaDescription(req);
  sendSuccess(res, schema);
}

/**
 * GET /tables - Get all tables overview
 */
async function tablesOverview(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Use a default table to get the model
  if (!req.tables || req.tables.length === 0) {
    throw new ModelError('No tables configured', ErrorCode.INTERNAL_SERVER_ERROR);
  }
  
  req.params.tableName = req.tables[0].id;
  const overview = await getAllTablesOverview(req);
  sendSuccess(res, overview);
}

// ============================================================================
// Router Registration
// ============================================================================

/**
 * Register data alias API routes
 * 
 * @example
 * ```typescript
 * import { Router } from 'express';
 * import { addDataAliasRoutes } from './dataAliasApis';
 * 
 * const router = Router();
 * addDataAliasRoutes(router);
 * ```
 */
export function addDataAliasRoutes(router: Router): void {
  // Table overview (AI-friendly)
  router.get(
    '/tables',
    apiMetrics,
    ncMetaAclMw(asyncHandler(tablesOverview), 'tablesOverview', { action: 'read' })
  );

  // List and Create
  router.get(
    '/:tableName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataList), 'dataList', { action: 'read' })
  );
  
  router.post(
    '/:tableName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataCreate), 'dataCreate', { action: 'create' })
  );

  // Find one
  router.get(
    '/:tableName/find-one',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataFindOne), 'dataFindOne', { action: 'read' })
  );

  // Count
  router.get(
    '/:tableName/count',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataCount), 'dataCount', { action: 'read' })
  );

  // GroupBy
  router.get(
    '/:tableName/groupby',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataGroupBy), 'dataGroupBy', { action: 'read' })
  );
  
  router.get(
    '/:tableName/groupby/:columnId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataGroupByColumn), 'dataGroupByColumn', { action: 'read' })
  );

  // Schema description (AI-friendly)
  router.get(
    '/:tableName/describe',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataDescribe), 'dataDescribe', { action: 'read' })
  );

  // View-specific list
  router.get(
    '/:tableName/views/:viewName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataListWithView), 'dataListWithView', { action: 'read' })
  );
  
  router.get(
    '/:tableName/views/:viewName/groupby/:columnId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataGroupByColumn), 'dataGroupByColumnView', { action: 'read' })
  );

  // Single record operations (must be after other routes to avoid conflicts)
  router.get(
    '/:tableName/:rowId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataRead), 'dataRead', { action: 'read' })
  );
  
  router.patch(
    '/:tableName/:rowId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataUpdate), 'dataUpdate', { action: 'update' })
  );
  
  router.delete(
    '/:tableName/:rowId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataDelete), 'dataDelete', { action: 'delete' })
  );

  // Existence check
  router.get(
    '/:tableName/:rowId/exist',
    apiMetrics,
    ncMetaAclMw(asyncHandler(dataExists), 'dataExists', { action: 'read' })
  );
}

export default addDataAliasRoutes;
