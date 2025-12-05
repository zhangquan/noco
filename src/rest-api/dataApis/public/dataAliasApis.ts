/**
 * Public Data API Handlers (Shared View)
 * @module rest-api/dataApis/public/dataAliasApis
 */

import type { Response, NextFunction, Router } from 'express';
import type { DataRecord } from '../../../types';
import { ModelError, ErrorCode } from '../../../core/NcError';
import {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  createPagedResponse,
  sendSuccess,
  validateRowId,
} from '../../helpers';
import { asyncHandler, apiMetrics, type AsyncHandler } from '../../middleware';
import type { AgentRequest, PagedResponse, SharedViewRouteParams } from '../../types';

// Reuse core business functions
import {
  getDataList,
  dataRowRead,
  getFindOne,
  dataInsertFun,
  getDataCount,
} from '../dataAliasApis';

// ============================================================================
// Shared View Resolution
// ============================================================================

/**
 * Resolve table from shared view ID
 * In a real implementation, this would look up the shared view configuration
 * and return the associated table with view-specific permissions
 */
async function resolveSharedView(
  req: AgentRequest,
  sharedViewId: string
): Promise<{ tableId: string; viewId: string; allowedOperations: string[] }> {
  // This is a placeholder - actual implementation would:
  // 1. Look up shared view by ID from database/cache
  // 2. Verify the shared view is still valid (not expired, not revoked)
  // 3. Return the table/view configuration and allowed operations
  
  // For now, we'll use the sharedViewId as the table name
  // In production, you would have a shared_views table to look this up
  
  if (!req.tables || req.tables.length === 0) {
    throw new ModelError('Tables not configured', ErrorCode.INTERNAL_SERVER_ERROR);
  }

  // Try to find a table that matches (for demo purposes)
  const table = req.tables.find(
    (t) => t.id === sharedViewId || t.title === sharedViewId
  );

  if (!table) {
    throw new ModelError(
      `Shared view '${sharedViewId}' not found or has expired`,
      ErrorCode.NOT_FOUND
    );
  }

  return {
    tableId: table.id,
    viewId: sharedViewId,
    allowedOperations: ['read', 'create'], // Typically limited operations for public views
  };
}

/**
 * Prepare request for shared view operations
 */
async function prepareSharedViewRequest(req: AgentRequest): Promise<void> {
  const sharedViewId = req.params.sharedViewId;
  
  if (!sharedViewId) {
    throw new ModelError('Shared view ID is required', ErrorCode.BAD_REQUEST);
  }

  const sharedView = await resolveSharedView(req, sharedViewId);
  
  // Set the table name in params for downstream handlers
  req.params.tableName = sharedView.tableId;
  req.params.viewName = sharedView.viewId;
  
  // Store allowed operations for permission checks
  (req as { sharedViewOperations?: string[] }).sharedViewOperations = sharedView.allowedOperations;
}

/**
 * Check if operation is allowed for shared view
 */
function checkSharedViewOperation(req: AgentRequest, operation: string): void {
  const allowedOps = (req as { sharedViewOperations?: string[] }).sharedViewOperations;
  
  if (!allowedOps || !allowedOps.includes(operation)) {
    throw new ModelError(
      `Operation '${operation}' is not allowed for this shared view`,
      ErrorCode.FORBIDDEN
    );
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /shared-view/:sharedViewId - List records
 */
async function publicDataList(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await prepareSharedViewRequest(req);
  checkSharedViewOperation(req, 'read');
  
  const result = await getDataList(req);
  sendSuccess(res, result);
}

/**
 * POST /shared-view/:sharedViewId - Create record (for form views)
 */
async function publicDataCreate(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await prepareSharedViewRequest(req);
  checkSharedViewOperation(req, 'create');
  
  if (!req.body || typeof req.body !== 'object') {
    throw new ModelError('Request body is required', ErrorCode.BAD_REQUEST);
  }
  
  const record = await dataInsertFun(req, req.body);
  sendSuccess(res, record, 201);
}

/**
 * GET /shared-view/:sharedViewId/:rowId - Get single record
 */
async function publicDataRead(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await prepareSharedViewRequest(req);
  checkSharedViewOperation(req, 'read');
  
  const record = await dataRowRead(req, req.params.rowId);
  sendSuccess(res, record);
}

/**
 * GET /shared-view/:sharedViewId/find-one - Find single record
 */
async function publicDataFindOne(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await prepareSharedViewRequest(req);
  checkSharedViewOperation(req, 'read');
  
  const record = await getFindOne(req);
  sendSuccess(res, record);
}

/**
 * GET /shared-view/:sharedViewId/count - Get record count
 */
async function publicDataCount(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await prepareSharedViewRequest(req);
  checkSharedViewOperation(req, 'read');
  
  const result = await getDataCount(req);
  sendSuccess(res, result);
}

// ============================================================================
// Router Registration
// ============================================================================

/**
 * Register public (shared view) data API routes
 * 
 * Routes:
 * - GET  /shared-view/:sharedViewId          - List records
 * - POST /shared-view/:sharedViewId          - Create record (form submission)
 * - GET  /shared-view/:sharedViewId/:rowId   - Get single record
 * - GET  /shared-view/:sharedViewId/find-one - Find single record
 * - GET  /shared-view/:sharedViewId/count    - Get record count
 */
export function addPublicDataAliasRoutes(router: Router): void {
  // List records
  router.get(
    '/shared-view/:sharedViewId',
    apiMetrics,
    asyncHandler(publicDataList)
  );

  // Create record (form submission)
  router.post(
    '/shared-view/:sharedViewId',
    apiMetrics,
    asyncHandler(publicDataCreate)
  );

  // Find one
  router.get(
    '/shared-view/:sharedViewId/find-one',
    apiMetrics,
    asyncHandler(publicDataFindOne)
  );

  // Count
  router.get(
    '/shared-view/:sharedViewId/count',
    apiMetrics,
    asyncHandler(publicDataCount)
  );

  // Get single record
  router.get(
    '/shared-view/:sharedViewId/:rowId',
    apiMetrics,
    asyncHandler(publicDataRead)
  );
}

export default addPublicDataAliasRoutes;
