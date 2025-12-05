/**
 * AgentDB REST API Module
 *
 * Provides a complete RESTful API for data CRUD operations,
 * relationship handling, and data export functionality.
 *
 * @module rest-api
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import knex from 'knex';
 * import { createRestApi } from 'agentdb/rest-api';
 *
 * const app = express();
 * const db = knex({ client: 'pg', connection: '...' });
 * const tables = [...]; // Your table definitions
 *
 * app.use(express.json());
 *
 * // Option 1: Quick setup with createRestApi
 * app.use(createRestApi({
 *   db,
 *   tables,
 *   basePath: '/api/v1/data',
 *   enablePublicApi: true,
 *   enableExportApi: true,
 * }));
 *
 * // Option 2: Manual setup with createDataRouter
 * import { createDataRouter, createContextMiddleware } from 'agentdb/rest-api';
 *
 * app.use(createContextMiddleware(db, tables));
 * app.use('/api/v1/data', createDataRouter({
 *   enablePublicApi: true,
 *   enableExportApi: true,
 * }));
 *
 * app.listen(3000);
 * ```
 */

// === Router Factory ===
export {
  createDataRouter,
  createRestApi,
  // Backwards compatibility
  registerDataRouter,
  registerRestApi,
  type RouterOptions,
  type ApiOptions,
} from './router';

// === Configuration ===
export {
  getConfig,
  setConfig,
  createConfig,
  DEFAULT_CONFIG,
  type RestApiConfig,
} from './config';

// === Types ===
export {
  // Request types
  type ApiRequest,
  type AuthUser,
  type RequestContext,
  type RequestCookie,
  type TableParams,
  type RowParams,
  type ColumnParams,
  type SharedViewParams,
  // Response types
  type PageInfo,
  type PagedResponse,
  type CountResponse,
  type ExistsResponse,
  type DeleteResponse,
  type BulkResult,
  type BulkError,
  type LinkResult,
  type UnlinkResult,
  type ExportResult,
  type SchemaResponse,
  type TablesOverviewResponse,
  type ErrorResponse,
  // Parameter types
  type ListParams,
  type FilterObject,
  type FilterValue,
  type SortObject,
  type GroupByParams,
  type ExportParams,
  type BulkWriteItem,
  type RawListQuery,
  type RawGroupByQuery,
  type DataRecord,
} from './types';

// === Middleware ===
export {
  // Context
  createContextMiddleware,
  createUserMiddleware,
  requireTable,
  type UserExtractor,
  // Auth
  authorize,
  requireAuth,
  optionalAuth,
  setPermissionChecker,
  type Action,
  type PermissionChecker,
  // Validation
  validateBody,
  validateRowId,
  validateColumn,
  validateExportFormat,
  validateQuery,
  // Error handling
  handler,
  errorHandler,
  notFoundHandler,
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalError,
  // Rate limiting
  rateLimit,
  strictRateLimit,
  type RateLimitOptions,
  // CORS
  cors,
  type CorsOptions,
  // Logging
  requestLogger,
  simpleLogger,
} from './middleware';

// === Services ===
export {
  RecordService,
  BulkService,
  RelationService,
  ExportService,
} from './services';

// === Handlers ===
export { records, bulk, relations, exportHandlers, publicHandlers } from './handlers';

// === Utilities ===
export {
  // Parser
  parseListParams,
  parseGroupByParams,
  parseRowIds,
  parseFields,
  filterObjectToArray,
  sortObjectToArray,
  // Response
  ok,
  created,
  noContent,
  buildPageInfo,
  paginate,
  bulkResult,
  download,
  downloadCsv,
  sendExportJson,
  // Serializer
  serializeCellValue,
  getRecordValue,
  escapeCsvValue,
  buildCsv,
  buildXlsxData,
  getExportableColumns,
} from './utils';

// === Default Export ===
import { createDataRouter, createRestApi } from './router';
export default {
  createDataRouter,
  createRestApi,
};
