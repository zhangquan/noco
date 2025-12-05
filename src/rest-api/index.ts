/**
 * AgentDB REST API Module
 * 
 * Provides a complete RESTful API for data CRUD operations,
 * relation handling, and data export functionality.
 * 
 * @module rest-api
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import knex from 'knex';
 * import { registerDataRouter, createDbContextMiddleware } from 'agentdb/rest-api';
 * 
 * const app = express();
 * const db = knex({ client: 'pg', connection: '...' });
 * const tables = [...]; // Your table definitions
 * 
 * // Register and mount the data router
 * const dataRouter = registerDataRouter({
 *   enablePublicApis: true,
 *   enableExportApis: true,
 * });
 * 
 * app.use(express.json());
 * app.use(createDbContextMiddleware(db, tables));
 * app.use('/api/v1/db/data', dataRouter);
 * 
 * app.listen(3000);
 * ```
 */

import { Router } from 'express';
import type { Knex } from 'knex';
import type { Table } from '../types';

// Re-export types
export * from './types';

// Re-export helpers
export {
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  createPagedResponse,
  sendSuccess,
  sendError,
  getColumnByIdOrName,
  getLinkColumn,
  getExportColumns,
  serializeCellValue,
  extractCsvData,
  extractXlsxData,
  getDbRows,
  validateRowId,
  validateRelationType,
  catchError,
} from './helpers';

// Re-export middleware
export {
  asyncHandler,
  errorHandler,
  ncMetaAclMw,
  createDbContextMiddleware,
  createUserContextMiddleware,
  apiMetrics,
  rateLimiter,
  validateBody,
  validateTable,
  corsMiddleware,
  type AsyncHandler,
} from './middleware';

// Re-export data APIs
export {
  registerDataApis,
  // Core CRUD
  addDataAliasRoutes,
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
  // Bulk operations
  addBulkDataAliasRoutes,
  bulkInsertFun,
  bulkUpdateFun,
  bulkUpdateAllFun,
  bulkDeleteFun,
  bulkDeleteAllFun,
  clearAllDataFun,
  clearColumnDataFun,
  bulkWriteFun,
  // Nested/Relations
  addNestedDataAliasRoutes,
  mmListFun,
  mmExcludedListFun,
  hmListFun,
  btListFun,
  relationDataAddFun,
  relationDataRemoveFun,
  bulkRelationAddFun,
  bulkRelationRemoveFun,
  // Export
  addExportDataAliasRoutes,
  exportCsvFun,
  exportXlsxFun,
  exportDataFun,
  // Public
  addPublicDataAliasRoutes,
} from './dataApis';

import { registerDataApis } from './dataApis';
import { createDbContextMiddleware, errorHandler, corsMiddleware } from './middleware';
import type { RestApiConfig, DEFAULT_REST_API_CONFIG } from './types';

// ============================================================================
// Router Factory
// ============================================================================

/**
 * Options for registering the data router
 */
export interface DataRouterOptions {
  /** Enable public (shared view) APIs */
  enablePublicApis?: boolean;
  /** Enable export APIs (CSV/Excel) */
  enableExportApis?: boolean;
  /** Enable CORS middleware */
  enableCors?: boolean;
  /** CORS allowed origins */
  corsOrigins?: string[];
  /** Enable error handler middleware */
  enableErrorHandler?: boolean;
}


/**
 * Register an Express router with all data APIs configured
 * 
 * @example
 * ```typescript
 * const router = registerDataRouter({
 *   enablePublicApis: true,
 *   enableExportApis: true,
 *   enableCors: true,
 * });
 * 
 * app.use('/api/v1/db/data', router);
 * ```
 */
export function registerDataRouter(options: DataRouterOptions = {}): Router {
  const {
    enablePublicApis = true,
    enableExportApis = true,
    enableCors = false,
    corsOrigins = ['*'],
    enableErrorHandler = true,
  } = options;

  const router = Router();

  // CORS middleware
  if (enableCors) {
    router.use(corsMiddleware({ origins: corsOrigins }));
  }

  // Register all data APIs
  registerDataApis(router, {
    enablePublicApis,
    enableExportApis,
  });

  // Error handler (should be last)
  if (enableErrorHandler) {
    router.use(errorHandler);
  }

  return router;
}

// ============================================================================
// Complete App Factory
// ============================================================================

/**
 * Options for registering the complete REST API
 */
export interface RestApiOptions extends DataRouterOptions {
  /** Knex database instance */
  db: Knex;
  /** Table definitions */
  tables: Table[];
  /** Base path for data APIs */
  basePath?: string;
  /** User extraction function for authentication */
  extractUser?: (req: unknown) => Promise<{ id: string; email?: string; display_name?: string } | undefined>;
}


/**
 * Register a complete Express router with database context and all APIs
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { registerRestApi } from 'agentdb/rest-api';
 * 
 * const app = express();
 * app.use(express.json());
 * 
 * const apiRouter = registerRestApi({
 *   db: knex,
 *   tables: myTables,
 *   basePath: '/api/v1/db/data',
 *   enablePublicApis: true,
 *   enableExportApis: true,
 * });
 * 
 * app.use(apiRouter);
 * app.listen(3000);
 * ```
 */
export function registerRestApi(options: RestApiOptions): Router {
  const {
    db,
    tables,
    basePath = '/api/v1/db/data',
    extractUser,
    ...routerOptions
  } = options;

  const router = Router();

  // Database context middleware
  router.use(createDbContextMiddleware(db, tables));

  // User context middleware (if provided)
  if (extractUser) {
    const { createUserContextMiddleware } = require('./middleware');
    router.use(createUserContextMiddleware(extractUser));
  }

  // Register the data router
  const dataRouter = registerDataRouter(routerOptions);
  router.use(basePath, dataRouter);

  return router;
}


// ============================================================================
// Default Export
// ============================================================================

export default {
  registerDataRouter,
  registerRestApi,
  registerDataApis,
};
