/**
 * Nested/Relation Data API Handlers
 * @module rest-api/dataApis/dataAliasNestedApis
 */

import type { Response, NextFunction, Router } from 'express';
import type { DataRecord, ListArgs, Column } from '../../types';
import { UITypes } from '../../types';
import { ModelError, ErrorCode } from '../../core/NcError';
import {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  createPagedResponse,
  sendSuccess,
  validateRowId,
  validateRelationType,
  getLinkColumn,
} from '../helpers';
import { asyncHandler, ncMetaAclMw, apiMetrics, type AsyncHandler } from '../middleware';
import type { AgentRequest, PagedResponse, NestedRouteParams } from '../types';

// ============================================================================
// Core Business Functions (Reusable)
// ============================================================================

/**
 * Get many-to-many linked records
 */
export async function mmListFun(
  req: AgentRequest,
  rowId: string,
  columnName: string
): Promise<PagedResponse<DataRecord>> {
  validateRowId(rowId);

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  const args: ListArgs = {
    ...parseListArgs(req.query as { [key: string]: string }),
    parentId: rowId,
  };

  const [list, count] = await Promise.all([
    model.links.mmList(column, args),
    model.links.mmListCount(column, args),
  ]);

  return createPagedResponse(list, count, args.offset, args.limit);
}

/**
 * Get excluded (not yet linked) records for many-to-many
 */
export async function mmExcludedListFun(
  req: AgentRequest,
  rowId: string,
  columnName: string
): Promise<PagedResponse<DataRecord>> {
  validateRowId(rowId);

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  const args: ListArgs = {
    ...parseListArgs(req.query as { [key: string]: string }),
    parentId: rowId,
  };

  const [list, count] = await Promise.all([
    model.links.mmExcludedList(column, args),
    model.links.mmExcludedListCount(column, args),
  ]);

  return createPagedResponse(list, count, args.offset, args.limit);
}

/**
 * Get one-to-many (has-many) linked records
 * Similar to mmList but for hm relations
 */
export async function hmListFun(
  req: AgentRequest,
  rowId: string,
  columnName: string
): Promise<PagedResponse<DataRecord>> {
  // For has-many, we use the same underlying mechanism as mm
  return mmListFun(req, rowId, columnName);
}

/**
 * Get many-to-one (belongs-to) linked record
 */
export async function btListFun(
  req: AgentRequest,
  rowId: string,
  columnName: string
): Promise<DataRecord | null> {
  validateRowId(rowId);

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  const args: ListArgs = {
    parentId: rowId,
    limit: 1,
  };

  const list = await model.links.mmList(column, args);
  return list.length > 0 ? list[0] : null;
}

/**
 * Add relation (link records)
 */
export async function relationDataAddFun(
  req: AgentRequest,
  rowId: string,
  relationType: 'mm' | 'hm' | 'bt',
  columnName: string,
  refRowId: string
): Promise<{ linked: boolean }> {
  validateRowId(rowId);
  validateRowId(refRowId);

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  await model.links.mmLink(column, [refRowId], rowId);

  return { linked: true };
}

/**
 * Remove relation (unlink records)
 */
export async function relationDataRemoveFun(
  req: AgentRequest,
  rowId: string,
  relationType: 'mm' | 'hm' | 'bt',
  columnName: string,
  refRowId: string
): Promise<{ unlinked: boolean }> {
  validateRowId(rowId);
  validateRowId(refRowId);

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  await model.links.mmUnlink(column, [refRowId], rowId);

  return { unlinked: true };
}

/**
 * Bulk add relations
 */
export async function bulkRelationAddFun(
  req: AgentRequest,
  rowId: string,
  columnName: string,
  refRowIds: string[]
): Promise<{ linkedCount: number }> {
  validateRowId(rowId);
  
  if (!Array.isArray(refRowIds) || refRowIds.length === 0) {
    throw new ModelError('Reference row IDs are required', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  await model.links.mmLink(column, refRowIds, rowId);

  return { linkedCount: refRowIds.length };
}

/**
 * Bulk remove relations
 */
export async function bulkRelationRemoveFun(
  req: AgentRequest,
  rowId: string,
  columnName: string,
  refRowIds: string[]
): Promise<{ unlinkedCount: number }> {
  validateRowId(rowId);
  
  if (!Array.isArray(refRowIds) || refRowIds.length === 0) {
    throw new ModelError('Reference row IDs are required', ErrorCode.BAD_REQUEST);
  }

  const ctx = getTableFromRequest(req);
  const column = getLinkColumn(ctx.table, columnName);

  if (!column) {
    throw new ModelError(
      `Link column '${columnName}' not found in '${ctx.table.title}'`,
      ErrorCode.NOT_FOUND
    );
  }

  const model = createModelFromRequest(ctx);
  
  if (!model.links) {
    throw new ModelError(
      'Link operations not available',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }

  await model.links.mmUnlink(column, refRowIds, rowId);

  return { unlinkedCount: refRowIds.length };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /:tableName/:rowId/mm/:columnName - Get many-to-many linked records
 */
async function mmList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await mmListFun(
    req,
    req.params.rowId,
    req.params.columnName
  );
  sendSuccess(res, result);
}

/**
 * GET /:tableName/:rowId/mm/:columnName/exclude - Get unlinked records for mm
 */
async function mmExcludedList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await mmExcludedListFun(
    req,
    req.params.rowId,
    req.params.columnName
  );
  sendSuccess(res, result);
}

/**
 * GET /:tableName/:rowId/hm/:columnName - Get has-many linked records
 */
async function hmList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await hmListFun(
    req,
    req.params.rowId,
    req.params.columnName
  );
  sendSuccess(res, result);
}

/**
 * GET /:tableName/:rowId/hm/:columnName/exclude - Get unlinked records for hm
 */
async function hmExcludedList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Use the same logic as mm excluded list
  const result = await mmExcludedListFun(
    req,
    req.params.rowId,
    req.params.columnName
  );
  sendSuccess(res, result);
}

/**
 * GET /:tableName/:rowId/bt/:columnName - Get belongs-to linked record
 */
async function btList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await btListFun(
    req,
    req.params.rowId,
    req.params.columnName
  );
  sendSuccess(res, result);
}

/**
 * POST /:tableName/:rowId/:relationType/:columnName/:refRowId - Add relation
 */
async function relationAdd(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const relationType = validateRelationType(req.params.relationType);
  const result = await relationDataAddFun(
    req,
    req.params.rowId,
    relationType,
    req.params.columnName,
    req.params.refRowId
  );
  sendSuccess(res, result, 201);
}

/**
 * DELETE /:tableName/:rowId/:relationType/:columnName/:refRowId - Remove relation
 */
async function relationRemove(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const relationType = validateRelationType(req.params.relationType);
  const result = await relationDataRemoveFun(
    req,
    req.params.rowId,
    relationType,
    req.params.columnName,
    req.params.refRowId
  );
  sendSuccess(res, result);
}

/**
 * POST /:tableName/:rowId/links/:columnName - Bulk add relations
 */
async function bulkRelationAdd(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const refRowIds = Array.isArray(req.body)
    ? req.body.map((item: unknown) =>
        typeof item === 'string' ? item : (item as DataRecord).id
      ).filter((id): id is string => Boolean(id))
    : [];

  const result = await bulkRelationAddFun(
    req,
    req.params.rowId,
    req.params.columnName,
    refRowIds
  );
  sendSuccess(res, result, 201);
}

/**
 * DELETE /:tableName/:rowId/links/:columnName - Bulk remove relations
 */
async function bulkRelationRemove(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // IDs can come from body or query
  let refRowIds: string[];
  
  if (Array.isArray(req.body)) {
    refRowIds = req.body.map((item: unknown) =>
      typeof item === 'string' ? item : (item as DataRecord).id
    ).filter((id): id is string => Boolean(id));
  } else if (req.query.ids) {
    refRowIds = (req.query.ids as string).split(',').map((id) => id.trim());
  } else {
    throw new ModelError('Reference row IDs are required', ErrorCode.BAD_REQUEST);
  }

  const result = await bulkRelationRemoveFun(
    req,
    req.params.rowId,
    req.params.columnName,
    refRowIds
  );
  sendSuccess(res, result);
}

// ============================================================================
// Router Registration
// ============================================================================

/**
 * Register nested data API routes
 * 
 * Routes:
 * - GET    /:tableName/:rowId/mm/:columnName         - Get mm linked records
 * - GET    /:tableName/:rowId/mm/:columnName/exclude - Get mm excluded records
 * - GET    /:tableName/:rowId/hm/:columnName         - Get hm linked records
 * - GET    /:tableName/:rowId/hm/:columnName/exclude - Get hm excluded records
 * - GET    /:tableName/:rowId/bt/:columnName         - Get bt linked record
 * - POST   /:tableName/:rowId/:relationType/:columnName/:refRowId - Add relation
 * - DELETE /:tableName/:rowId/:relationType/:columnName/:refRowId - Remove relation
 * - POST   /:tableName/:rowId/links/:columnName      - Bulk add relations
 * - DELETE /:tableName/:rowId/links/:columnName      - Bulk remove relations
 */
export function addNestedDataAliasRoutes(router: Router): void {
  // Many-to-many linked records
  router.get(
    '/:tableName/:rowId/mm/:columnName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(mmList), 'mmList', { action: 'read' })
  );

  router.get(
    '/:tableName/:rowId/mm/:columnName/exclude',
    apiMetrics,
    ncMetaAclMw(asyncHandler(mmExcludedList), 'mmExcludedList', { action: 'read' })
  );

  // Has-many linked records
  router.get(
    '/:tableName/:rowId/hm/:columnName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(hmList), 'hmList', { action: 'read' })
  );

  router.get(
    '/:tableName/:rowId/hm/:columnName/exclude',
    apiMetrics,
    ncMetaAclMw(asyncHandler(hmExcludedList), 'hmExcludedList', { action: 'read' })
  );

  // Belongs-to linked record
  router.get(
    '/:tableName/:rowId/bt/:columnName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(btList), 'btList', { action: 'read' })
  );

  // Bulk link operations
  router.post(
    '/:tableName/:rowId/links/:columnName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(bulkRelationAdd), 'bulkRelationAdd', { action: 'link' })
  );

  router.delete(
    '/:tableName/:rowId/links/:columnName',
    apiMetrics,
    ncMetaAclMw(asyncHandler(bulkRelationRemove), 'bulkRelationRemove', { action: 'unlink' })
  );

  // Single relation add/remove (must be last due to dynamic :relationType)
  router.post(
    '/:tableName/:rowId/:relationType/:columnName/:refRowId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(relationAdd), 'relationAdd', { action: 'link' })
  );

  router.delete(
    '/:tableName/:rowId/:relationType/:columnName/:refRowId',
    apiMetrics,
    ncMetaAclMw(asyncHandler(relationRemove), 'relationRemove', { action: 'unlink' })
  );
}

export default addNestedDataAliasRoutes;
