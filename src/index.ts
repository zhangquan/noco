/**
 * AgentDB
 * AI Agent-friendly PostgreSQL database layer with JSONB storage
 *
 * @module agentdb
 */

import type { Knex } from 'knex';
import type { Table } from './types';
import { TABLE_DATA, TABLE_LINKS } from './config';

// ============================================================================
// Model Factory - Main Entry Point
// ============================================================================

import type { ModelContextParams } from './core/ModelContext';
import {
  Model,
  createModel as createModelFromFactory,
  createLazyModel as createLazyModelFromFactory,
  createCopyModel as createCopyModelFromFactory,
  createFullModel as createFullModelFromFactory,
  createMinimalModel as createMinimalModelFromFactory,
  type ModelOptions,
} from './models/Model';

/**
 * Create a model with default options (virtual columns + link operations)
 *
 * @example
 * ```typescript
 * const model = createModel({
 *   db: knex,
 *   tableId: 'tbl_users',
 *   tables: allTables,
 * });
 *
 * const users = await model.list({ limit: 10 });
 * ```
 */
export function createModel(params: ModelContextParams): Model {
  return createModelFromFactory(params);
}

/**
 * Create a model with lazy loading enabled
 * Automatically loads related records when accessed
 *
 * @example
 * ```typescript
 * const model = createLazyModel({
 *   db: knex,
 *   tableId: 'tbl_orders',
 *   tables: allTables,
 * });
 *
 * const orders = await model.lazy?.listWithRelations({ limit: 10 });
 * ```
 */
export function createLazyModel(params: ModelContextParams): Model {
  return createLazyModelFromFactory(params);
}

/**
 * Create a model with copy operations enabled
 * Supports deep record duplication with relations
 *
 * @example
 * ```typescript
 * const model = createCopyModel({
 *   db: knex,
 *   tableId: 'tbl_templates',
 *   tables: allTables,
 * });
 *
 * const copy = await model.copy?.copyRecordDeep('rec_123', { deepCopy: true });
 * ```
 */
export function createCopyModel(params: ModelContextParams): Model {
  return createCopyModelFromFactory(params);
}

/**
 * Create a model with all features enabled
 *
 * @example
 * ```typescript
 * const model = createFullModel({
 *   db: knex,
 *   tableId: 'tbl_projects',
 *   tables: allTables,
 * });
 * ```
 */
export function createFullModel(params: ModelContextParams): Model {
  return createFullModelFromFactory(params);
}

/**
 * Create a minimal model with only CRUD operations
 * Best performance, no virtual columns or link support
 *
 * @example
 * ```typescript
 * const model = createMinimalModel({
 *   db: knex,
 *   tableId: 'tbl_logs',
 *   tables: allTables,
 * });
 * ```
 */
export function createMinimalModel(params: ModelContextParams): Model {
  return createMinimalModelFromFactory(params);
}

// ============================================================================
// Database Setup
// ============================================================================

/**
 * Initialize database schema - creates required tables for data storage
 * @param db - Knex database instance
 * @example
 * ```typescript
 * await initDatabase(db);
 * ```
 */
export async function initDatabase(db: Knex): Promise<void> {
  // Main data table - stores all records with JSONB data
  const hasDataTable = await db.schema.hasTable(TABLE_DATA);
  if (!hasDataTable) {
    await db.schema.createTable(TABLE_DATA, (t) => {
      t.string('id', 26).primary();                          // ULID primary key
      t.string('table_id', 36).notNullable().index();        // Table identifier for isolation
      t.jsonb('data').notNullable().defaultTo('{}');         // User data as JSONB
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.string('created_by', 36).nullable();
      t.string('updated_by', 36).nullable();
      
      // Composite indexes for common queries
      t.index(['table_id', 'created_at']);
      t.index(['table_id', 'updated_at']);
    });

    // GIN index for JSONB queries (must be done with raw SQL)
    await db.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE_DATA}_data ON ${TABLE_DATA} USING GIN(data)`);
  }

  // Record links table - stores relationships between records
  const hasLinksTable = await db.schema.hasTable(TABLE_LINKS);
  if (!hasLinksTable) {
    await db.schema.createTable(TABLE_LINKS, (t) => {
      t.string('id', 26).primary();                          // ULID primary key
      t.string('source_record_id', 26).notNullable();        // Source record ID
      t.string('target_record_id', 26).notNullable();        // Target record ID
      t.string('link_field_id', 36).notNullable();           // Link field ID (defines the relationship)
      t.string('inverse_field_id', 36).nullable();           // Inverse field ID (for bidirectional links)
      t.timestamp('created_at').defaultTo(db.fn.now());
      
      // Indexes for efficient lookups
      t.index(['link_field_id', 'source_record_id']);        // Find targets for a source
      t.index(['link_field_id', 'target_record_id']);        // Find sources for a target
      t.index('source_record_id');                           // Cascade delete lookups
      t.index('target_record_id');                           // Cascade delete lookups
      
      // Prevent duplicate links
      t.unique(['source_record_id', 'target_record_id', 'link_field_id']);
    });
  }
}

/**
 * Drop database tables - use with caution, this will delete all data
 * @param db - Knex database instance
 */
export async function dropDatabase(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists(TABLE_LINKS);
  await db.schema.dropTableIfExists(TABLE_DATA);
}

/**
 * @deprecated Use initDatabase instead
 */
export const createTables = initDatabase;

/**
 * @deprecated Use dropDatabase instead
 */
export const dropTables = dropDatabase;

// ============================================================================
// Re-exports
// ============================================================================

// Types
export type {
  Column,
  ColumnOption,
  ColumnConstraints,
  Table,
  Filter,
  FilterOperator,
  Sort,
  SortDirection,
  ListArgs,
  GroupByArgs,
  BulkOptions,
  RequestContext,
  DataRecord,
  Record,
  // Schema description types (AI-friendly)
  RelationType,
  RelationshipInfo,
  SchemaDescription,
  TableOverview,
  // Simplified filter/sort (AI-friendly)
  SimpleFilter,
  SimpleFilterCondition,
  SimpleSort,
  // Bulk write types (AI-friendly)
  BulkWriteOperation,
  BulkInsertOp,
  BulkUpdateOp,
  BulkDeleteOp,
  BulkLinkOp,
  BulkUnlinkOp,
  BulkWriteOperationResult,
  BulkWriteResult,
} from './types';
export { UITypes } from './types';

// Filter/Sort parser utilities
export { parseSimpleFilter, parseSimpleSort } from './utils/filterParser';

// Config
export {
  TABLE_DATA,
  TABLE_LINKS,
  TABLE_RELATIONS,  // deprecated alias
  PAGINATION,
  BULK_OPERATIONS,
  type ModelConfig,
  type Logger,
  DEFAULT_MODEL_CONFIG,
  consoleLogger,
  silentLogger,
} from './config';

// Core - Error handling
export { 
  ModelError, 
  NcError,  // deprecated alias
  ErrorCode, 
  HTTP_STATUS, 
  type ModelErrorType,
  type NcErrorType,  // deprecated alias
} from './core/NcError';
export {
  ModelContext,
  createContext,
  type IModelContext,
  type ModelContextParams,
} from './core/ModelContext';

// Operations
export {
  CrudOperations,
  createCrudOperations,
  type ICrudOperations,
  LinkOperations,
  createLinkOperations,
  type ILinkOperations,
  VirtualColumnOperations,
  createVirtualColumnOperations,
  type IVirtualColumnOperations,
  LazyOperations,
  createLazyOperations,
  type ILazyOperations,
  CopyOperations,
  createCopyOperations,
  type ICopyOperations,
  type CopyOptions,
  type CopyRelationOptions,
} from './core/operations';

// Models
export { Model, type IModel, type ModelOptions } from './models/Model';

// Schema Management
export {
  SchemaManager,
  createSchemaManager,
  type ISchemaManager,
  type ColumnDefinition,
  type TableDefinition,
  type LinkDefinition,
  type SchemaExport,
} from './schema';

// Query utilities
export { buildFormulaExpression } from './query/formulaBuilder';
export { buildRollupSubquery } from './query/rollupBuilder';
export { buildLinkCountSubquery } from './query/linkBuilder';
export { applyConditions } from './query/conditionBuilder';
export { applySorts } from './query/sortBuilder';

// Function mappings
export { commonFunctions, postgresFunctions, getFunction } from './functions';

// Utilities
export { sanitize } from './utils/sanitize';
export {
  isSystemColumn,
  isVirtualColumn,
  getColumnsWithPk,
  parseFields,
} from './utils/columnUtils';
export { parseRow, parseRows } from './utils/rowParser';

// ============================================================================
// REST API
// ============================================================================

// REST API module - provides Express-based RESTful APIs
export {
  // Router factories
  createDataRouter,
  createRestApi,
  registerDataApis,
  // Types
  type AgentRequest,
  type PagedResponse,
  type BulkOperationResponse,
  type RestApiConfig,
  type CreateDataRouterOptions,
  type CreateRestApiOptions,
  type AsyncHandler,
  // Middleware
  asyncHandler,
  errorHandler,
  ncMetaAclMw,
  createDbContextMiddleware,
  createUserContextMiddleware,
  apiMetrics,
  rateLimiter,
  corsMiddleware,
  // Helpers
  getTableFromRequest,
  createModelFromRequest,
  parseListArgs,
  createPagedResponse,
  sendSuccess,
  sendError,
  catchError,
  // Route handlers
  addDataAliasRoutes,
  addBulkDataAliasRoutes,
  addNestedDataAliasRoutes,
  addExportDataAliasRoutes,
  addPublicDataAliasRoutes,
} from './rest-api';
