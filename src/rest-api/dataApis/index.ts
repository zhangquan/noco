/**
 * Data APIs Module Entry
 * Exports all data API route handlers and business functions
 * @module rest-api/dataApis
 */

import type { Router } from 'express';

// Core CRUD APIs
export {
  addDataAliasRoutes,
  // Business functions (reusable)
  getDataList,
  dataRowRead,
  getFindOne,
  dataInsertFun,
  dataUpdateFun,
  dataDeleteFun,
  dataExistFun,
  getDataCount,
  getDataGroupBy,
  getSchemaDescription,
  getAllTablesOverview,
} from './dataAliasApis';

// Bulk Operations APIs
export {
  addBulkDataAliasRoutes,
  bulkInsertFun,
  bulkUpdateFun,
  bulkUpdateAllFun,
  bulkDeleteFun,
  bulkDeleteAllFun,
  clearAllDataFun,
  clearColumnDataFun,
  bulkWriteFun,
} from './bulkDataAliasApis';

// Nested/Relation APIs
export {
  addNestedDataAliasRoutes,
  mmListFun,
  mmExcludedListFun,
  hmListFun,
  btListFun,
  relationDataAddFun,
  relationDataRemoveFun,
  bulkRelationAddFun,
  bulkRelationRemoveFun,
} from './dataAliasNestedApis';

// Export APIs
export {
  addExportDataAliasRoutes,
  exportCsvFun,
  exportXlsxFun,
  exportDataFun,
} from './dataAliasExportApis';

// Public (Shared View) APIs
export { addPublicDataAliasRoutes } from './public';

// ============================================================================
// Combined Router Registration
// ============================================================================

import { addDataAliasRoutes } from './dataAliasApis';
import { addBulkDataAliasRoutes } from './bulkDataAliasApis';
import { addNestedDataAliasRoutes } from './dataAliasNestedApis';
import { addExportDataAliasRoutes } from './dataAliasExportApis';
import { addPublicDataAliasRoutes } from './public';

/**
 * Register all data API routes on a router
 * 
 * @example
 * ```typescript
 * import { Router } from 'express';
 * import { registerDataApis } from './dataApis';
 * 
 * const router = Router();
 * registerDataApis(router, { enablePublicApis: true, enableExportApis: true });
 * 
 * app.use('/api/v1/db/data', router);
 * ```
 */
export function registerDataApis(
  router: Router,
  options: {
    enablePublicApis?: boolean;
    enableExportApis?: boolean;
    basePath?: string;
  } = {}
): void {
  const {
    enablePublicApis = true,
    enableExportApis = true,
  } = options;

  // Register bulk routes first (more specific paths)
  addBulkDataAliasRoutes(router);

  // Register export routes (before core routes to avoid path conflicts)
  if (enableExportApis) {
    addExportDataAliasRoutes(router);
  }

  // Register nested/relation routes
  addNestedDataAliasRoutes(router);

  // Register core CRUD routes
  addDataAliasRoutes(router);

  // Register public routes
  if (enablePublicApis) {
    addPublicDataAliasRoutes(router);
  }
}

export default registerDataApis;
