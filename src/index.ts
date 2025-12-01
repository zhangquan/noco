/**
 * NocoDB Database Layer
 *
 * A clean, extensible database abstraction layer for PostgreSQL with JSONB storage.
 *
 * @example
 * ```typescript
 * import { createModel, createTables } from 'nocodb-db-layer';
 *
 * // Setup database tables
 * await createTables(knex);
 *
 * // Create a model instance
 * const model = createModel({
 *   db: knex,
 *   tableId: 'table_xyz',
 *   tables: allTableDefinitions,
 * });
 *
 * // CRUD operations
 * const record = await model.insert({ name: 'John', email: 'john@example.com' });
 * const records = await model.list({ limit: 10 });
 * await model.updateByPk(record.id, { name: 'Jane' });
 *
 * // Link operations
 * await model.addLink({ colId: 'link_col', rowId: record.id, childId: 'child_id' });
 * const linked = await model.mmList({ colId: 'link_col', parentRowId: record.id });
 * ```
 *
 * @module nocodb-db-layer
 */

import type { Knex } from 'knex';
import { Model, LazyModel, CopyModel } from './models';
import type { Table } from './types';
import { TABLE_DATA, TABLE_RELATIONS, ModelConfig } from './config';

// ============================================================================
// Re-exports
// ============================================================================

// Types
export * from './types';

// Config
export { TABLE_DATA, TABLE_RELATIONS, PAGINATION, BULK_OPERATIONS, DEFAULT_MODEL_CONFIG } from './config';
export type { ModelConfig } from './config';

// Core
export { NcError, ErrorCode } from './core';
export type { IBaseModel, ILinkModel, IModel } from './core';
export { BaseModel, LinkModel } from './core';

// Models
export { Model, LazyModel, CopyModel } from './models';
export type { CopyOptions, CopyResult } from './models';

// Query building
export {
  getTableName,
  getColumnExpression,
  createQueryBuilder,
  applyPagination,
  buildPkWhere,
} from './query';

// Utils
export { sanitize, unsanitize, sanitizeIdentifier } from './utils/sanitize';
export {
  isSystemColumn,
  isVirtualColumn,
  getColumns,
  getColumnsWithPk,
  getPrimaryKey,
  getColumnById,
  getColumnByName,
  getTableById,
  parseFields,
} from './utils/columnUtils';

// Functions
export { getFunction, hasFunction, getFunctionNames } from './functions';

// ============================================================================
// Model Types
// ============================================================================

/**
 * Available model types
 */
export type ModelType = 'default' | 'lazy' | 'copy';

/**
 * Model creation parameters
 */
export interface CreateModelParams {
  /** Knex database instance */
  db: Knex;
  /** Table ID */
  tableId: string;
  /** All table definitions */
  tables: Table[];
  /** Optional view ID */
  viewId?: string;
  /** Optional table alias */
  alias?: string;
  /** Model type */
  type?: ModelType;
  /** Configuration overrides */
  config?: Partial<ModelConfig>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a model instance
 *
 * @param params - Model creation parameters
 * @returns Model instance
 *
 * @example
 * ```typescript
 * // Default model with full features
 * const model = createModel({
 *   db: knex,
 *   tableId: 'users',
 *   tables: allTables,
 * });
 *
 * // Lazy loading model
 * const lazyModel = createModel({
 *   db: knex,
 *   tableId: 'users',
 *   tables: allTables,
 *   type: 'lazy',
 * });
 *
 * // Copy-enabled model
 * const copyModel = createModel({
 *   db: knex,
 *   tableId: 'users',
 *   tables: allTables,
 *   type: 'copy',
 * });
 * ```
 */
export function createModel(params: CreateModelParams): Model | LazyModel | CopyModel {
  const { type = 'default', ...rest } = params;

  switch (type) {
    case 'lazy':
      return new LazyModel(rest);
    case 'copy':
      return new CopyModel(rest);
    default:
      return new Model(rest);
  }
}

/**
 * Create a lazy loading model instance
 */
export function createLazyModel(params: Omit<CreateModelParams, 'type'>): LazyModel {
  return new LazyModel(params);
}

/**
 * Create a copy-enabled model instance
 */
export function createCopyModel(params: Omit<CreateModelParams, 'type'>): CopyModel {
  return new CopyModel(params);
}

// ============================================================================
// Database Setup
// ============================================================================

/**
 * Create required database tables
 *
 * @param db - Knex instance
 *
 * @example
 * ```typescript
 * await createTables(knex);
 * ```
 */
export async function createTables(db: Knex): Promise<void> {
  // Create main data table
  const hasMainTable = await db.schema.hasTable(TABLE_DATA);
  if (!hasMainTable) {
    await db.schema.createTable(TABLE_DATA, (table) => {
      table.string('id').primary();
      table.string('fk_table_id').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
      table.string('created_by');
      table.string('updated_by');
      table.jsonb('data');

      table.index(['fk_table_id']);
      table.index(['fk_table_id', 'created_at']);
      table.index(['fk_table_id', 'updated_at']);
    });

    await db.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE_DATA}_data ON ${TABLE_DATA} USING GIN(data)`
    );
  }

  // Create relations table
  const hasRelationsTable = await db.schema.hasTable(TABLE_RELATIONS);
  if (!hasRelationsTable) {
    await db.schema.createTable(TABLE_RELATIONS, (table) => {
      table.string('id').primary();
      table.string('fk_table_id').notNullable();
      table.string('fk_parent_id');
      table.string('fk_child_id');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());

      table.index(['fk_table_id', 'fk_parent_id']);
      table.index(['fk_table_id', 'fk_child_id']);
      table.index(['fk_table_id', 'fk_parent_id', 'fk_child_id']);
    });
  }
}

/**
 * Drop database tables
 *
 * @param db - Knex instance
 */
export async function dropTables(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists(TABLE_RELATIONS);
  await db.schema.dropTableIfExists(TABLE_DATA);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createModel,
  createLazyModel,
  createCopyModel,
  createTables,
  dropTables,
};
