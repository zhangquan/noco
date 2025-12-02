/**
 * NocoDB SQL Module
 * A modular database abstraction layer for PostgreSQL with JSONB storage
 *
 * @module nocodb-sql
 */

import type { Knex } from 'knex';
import type { Table } from './types';
import { TABLE_DATA, TABLE_RELATIONS } from './config';

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
  // Main data table
  const hasDataTable = await db.schema.hasTable(TABLE_DATA);
  if (!hasDataTable) {
    await db.schema.createTable(TABLE_DATA, (t) => {
      t.string('id', 26).primary();
      t.string('fk_table_id', 36).notNullable().index();
      t.jsonb('data').notNullable().defaultTo('{}');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
      t.string('created_by', 36).nullable();
      t.string('updated_by', 36).nullable();
    });
  }

  // Relations table for many-to-many
  const hasRelTable = await db.schema.hasTable(TABLE_RELATIONS);
  if (!hasRelTable) {
    await db.schema.createTable(TABLE_RELATIONS, (t) => {
      t.string('id', 26).primary();
      t.string('fk_parent_id', 26).notNullable().index();
      t.string('fk_child_id', 26).notNullable().index();
      t.string('fk_mm_parent_column_id', 36).notNullable().index();
      t.string('fk_mm_child_column_id', 36).nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.unique(['fk_parent_id', 'fk_child_id', 'fk_mm_parent_column_id']);
    });
  }
}

/**
 * Drop database tables - use with caution, this will delete all data
 * @param db - Knex database instance
 */
export async function dropDatabase(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists(TABLE_RELATIONS);
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
} from './types';
export { UITypes } from './types';

// Config
export {
  TABLE_DATA,
  TABLE_RELATIONS,
  PAGINATION,
  BULK_OPERATIONS,
  type ModelConfig,
  DEFAULT_MODEL_CONFIG,
} from './config';

// Core
export { NcError, ErrorCode, HTTP_STATUS, type NcErrorType } from './core/NcError';
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
