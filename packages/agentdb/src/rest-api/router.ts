/**
 * REST API Router
 * Unified route registration
 * @module rest-api/router
 */

import { Router } from 'express';
import type { Knex } from 'knex';
import type { Table } from '../types';
import type { RestApiConfig } from './config';
import { getConfig, createConfig } from './config';
import {
  createContextMiddleware,
  createUserMiddleware,
  authorize,
  requireTable,
  validateBody,
  validateRowId,
  errorHandler,
  notFoundHandler,
  rateLimit,
  cors,
  requestLogger,
  type UserExtractor,
} from './middleware';
import { records, bulk, relations, exportHandlers, publicHandlers } from './handlers';

/**
 * Router configuration options
 */
export interface RouterOptions {
  /** Enable public (shared view) APIs */
  enablePublicApi?: boolean;
  /** Enable export APIs (CSV/Excel) */
  enableExportApi?: boolean;
  /** Enable CORS */
  enableCors?: boolean;
  /** Enable rate limiting */
  enableRateLimit?: boolean;
  /** Enable request logging */
  enableLogging?: boolean;
  /** Enable error handler */
  enableErrorHandler?: boolean;
  /** Custom configuration overrides */
  config?: Partial<RestApiConfig>;
}

/**
 * Create data API router
 * Contains all route handlers without context middleware
 *
 * @param options - Router options
 */
export function createDataRouter(options: RouterOptions = {}): Router {
  const {
    enablePublicApi = true,
    enableExportApi = true,
    enableCors = false,
    enableRateLimit = false,
    enableLogging = true,
    enableErrorHandler = true,
  } = options;

  const router = Router();

  // === Global Middleware ===

  if (enableCors) {
    router.use(cors());
  }

  if (enableRateLimit) {
    router.use(rateLimit());
  }

  if (enableLogging) {
    router.use(requestLogger());
  }

  // === Schema Routes (no table required) ===

  router.get('/tables', records.listTables);

  // === Bulk Routes (register first - more specific paths) ===

  router.post(
    '/bulk/:tableName',
    requireTable,
    authorize('bulkCreate'),
    validateBody('array'),
    bulk.bulkCreate
  );

  router.patch(
    '/bulk/:tableName',
    requireTable,
    authorize('bulkUpdate'),
    validateBody('array'),
    bulk.bulkUpdate
  );

  router.patch(
    '/bulk/:tableName/all',
    requireTable,
    authorize('bulkUpdate'),
    validateBody('object'),
    bulk.bulkUpdateAll
  );

  router.delete(
    '/bulk/:tableName',
    requireTable,
    authorize('bulkDelete'),
    bulk.bulkDelete
  );

  router.delete(
    '/bulk/:tableName/all',
    requireTable,
    authorize('bulkDelete'),
    bulk.bulkDeleteAll
  );

  router.delete(
    '/bulk/:tableName/truncate',
    requireTable,
    authorize('bulkDelete'),
    bulk.truncate
  );

  router.post(
    '/bulk/:tableName/write',
    requireTable,
    authorize('bulkCreate'),
    validateBody('array'),
    bulk.bulkWrite
  );

  // === Export Routes ===

  if (enableExportApi) {
    router.get(
      '/:tableName/export',
      requireTable,
      authorize('export'),
      exportHandlers.exportData
    );

    router.get(
      '/:tableName/export/csv',
      requireTable,
      authorize('export'),
      exportHandlers.exportCsv
    );

    router.get(
      '/:tableName/export/xlsx',
      requireTable,
      authorize('export'),
      exportHandlers.exportXlsx
    );

    router.get(
      '/:tableName/export/:format',
      requireTable,
      authorize('export'),
      exportHandlers.exportAs
    );

    router.post(
      '/:tableName/export',
      requireTable,
      authorize('export'),
      exportHandlers.exportWithOptions
    );
  }

  // === Relation Routes ===

  router.get(
    '/:tableName/:rowId/links/:columnName',
    requireTable,
    validateRowId,
    authorize('read'),
    relations.listLinked
  );

  router.get(
    '/:tableName/:rowId/links/:columnName/available',
    requireTable,
    validateRowId,
    authorize('read'),
    relations.listAvailable
  );

  router.get(
    '/:tableName/:rowId/links/:columnName/one',
    requireTable,
    validateRowId,
    authorize('read'),
    relations.getLinked
  );

  router.post(
    '/:tableName/:rowId/links/:columnName',
    requireTable,
    validateRowId,
    authorize('link'),
    validateBody('array'),
    relations.link
  );

  router.delete(
    '/:tableName/:rowId/links/:columnName',
    requireTable,
    validateRowId,
    authorize('unlink'),
    relations.unlink
  );

  router.post(
    '/:tableName/:rowId/links/:columnName/:targetId',
    requireTable,
    validateRowId,
    authorize('link'),
    relations.linkOne
  );

  router.delete(
    '/:tableName/:rowId/links/:columnName/:targetId',
    requireTable,
    validateRowId,
    authorize('unlink'),
    relations.unlinkOne
  );

  // === Record Utility Routes ===

  router.get(
    '/:tableName/find-one',
    requireTable,
    authorize('read'),
    records.findOne
  );

  router.get(
    '/:tableName/count',
    requireTable,
    authorize('read'),
    records.count
  );

  router.get(
    '/:tableName/groupby',
    requireTable,
    authorize('read'),
    records.groupBy
  );

  router.get(
    '/:tableName/groupby/:columnId',
    requireTable,
    authorize('read'),
    records.groupBy
  );

  router.get(
    '/:tableName/schema',
    requireTable,
    authorize('read'),
    records.describeSchema
  );

  // === Record CRUD Routes ===

  router.get(
    '/:tableName',
    requireTable,
    authorize('read'),
    records.listRecords
  );

  router.post(
    '/:tableName',
    requireTable,
    authorize('create'),
    validateBody('object'),
    records.createRecord
  );

  router.get(
    '/:tableName/:rowId',
    requireTable,
    validateRowId,
    authorize('read'),
    records.getRecord
  );

  router.patch(
    '/:tableName/:rowId',
    requireTable,
    validateRowId,
    authorize('update'),
    validateBody('object'),
    records.updateRecord
  );

  router.delete(
    '/:tableName/:rowId',
    requireTable,
    validateRowId,
    authorize('delete'),
    records.deleteRecord
  );

  router.get(
    '/:tableName/:rowId/exists',
    requireTable,
    validateRowId,
    authorize('read'),
    records.checkExists
  );

  // === Public (Shared View) Routes ===

  if (enablePublicApi) {
    router.get('/shared/:viewId', publicHandlers.listRecords);
    router.post('/shared/:viewId', validateBody('object'), publicHandlers.createRecord);
    router.get('/shared/:viewId/find-one', publicHandlers.findOne);
    router.get('/shared/:viewId/count', publicHandlers.count);
    router.get('/shared/:viewId/:rowId', publicHandlers.getRecord);
  }

  // === Error Handling ===

  if (enableErrorHandler) {
    router.use(notFoundHandler as any);
    router.use(errorHandler as any);
  }

  return router;
}

/**
 * Full API setup options
 */
export interface ApiOptions extends RouterOptions {
  /** Knex database instance */
  db: Knex;
  /** Table definitions */
  tables: Table[];
  /** Base path for data APIs */
  basePath?: string;
  /** User extraction function */
  extractUser?: UserExtractor;
}

/**
 * Create complete REST API router with context
 * Includes database context and all middleware
 *
 * @param options - API options
 */
export function createRestApi(options: ApiOptions): Router {
  const {
    db,
    tables,
    basePath = '/api/v1/data',
    extractUser,
    config,
    ...routerOptions
  } = options;

  // Apply configuration
  if (config) {
    createConfig(config);
  }

  const router = Router();

  // Database context middleware
  router.use(createContextMiddleware(db, tables));

  // User context middleware
  if (extractUser) {
    router.use(createUserMiddleware(extractUser));
  }

  // Data router
  const dataRouter = createDataRouter(routerOptions);
  router.use(basePath, dataRouter);

  return router;
}

// Backwards compatibility aliases
export const registerDataRouter = createDataRouter;
export const registerRestApi = createRestApi;
