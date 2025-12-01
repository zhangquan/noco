import type { Knex } from 'knex';
import { JSONModelSqlImp } from './impl/JSONModelSqlImp';
import { JSONLinkModelSql } from './impl/JSONLinkModelSql';
import { LazyloadLinkModelSql } from './impl/LazyloadLinkModelSql';
import { CopySqlImp } from './impl/CopySqlImp';
import type { BaseModelSql } from './interface/BaseModelSql';
import type { LinkModelSql } from './interface/LinkModelSql';
import type { TableType, ModelConfig } from './interface/types';

// ========================================
// Re-exports
// ========================================

// Interfaces
export * from './interface/types';
export * from './interface/BaseModelSql';
export * from './interface/LinkModelSql';
export * from './interface/NcError';

// Abstract classes
export * from './abstract/AbstractBaseModelSql';
export * from './abstract/AbstractLinkModelSql';

// Implementations
export * from './impl/JSONModelSqlImp';
export * from './impl/JSONLinkModelSql';
export * from './impl/LazyloadLinkModelSql';
export * from './impl/CopySqlImp';

// Helpers
export * from './helpers/sanitize';
export * from './helpers/queryBuilderHelper';
export * from './helpers/condition';
export * from './helpers/sortBuilder';

// Query builders
export * from './queryBuilder/formulaQueryBuilderV2';
export * from './queryBuilder/genRollupSelectV2';
export * from './queryBuilder/genLinkCountToSelect';

// Function mappings
export * from './functionMappings/commonFns';
export * from './functionMappings/pg';

// ========================================
// Model Types
// ========================================

/**
 * Available model types
 */
export type ModelType = 'json' | 'link' | 'lazyload' | 'copy';

/**
 * Factory function parameters
 */
export interface GetBaseModelParams {
  /** Database driver (Knex instance) */
  dbDriver: Knex;
  /** Model/table ID */
  modelId: string;
  /** All models/tables definitions */
  models: TableType[];
  /** Optional view ID */
  viewId?: string;
  /** Optional table alias for queries */
  alias?: string;
  /** Model type to create */
  type?: ModelType;
  /** Optional configuration overrides */
  config?: Partial<ModelConfig>;
}

// ========================================
// Factory Function
// ========================================

/**
 * Get a base model instance
 *
 * @param params - Parameters for model creation
 * @returns BaseModelSql & LinkModelSql implementation
 *
 * @example
 * ```typescript
 * const model = getBaseModel({
 *   dbDriver: knex,
 *   modelId: 'table_xyz',
 *   models: allTableDefinitions,
 *   type: 'json' // default
 * });
 *
 * // CRUD operations
 * const record = await model.insert({ name: 'John', email: 'john@example.com' });
 * const records = await model.list({ limit: 10 });
 * await model.updateByPk(record.id, { name: 'Jane' });
 *
 * // Link operations (if using 'json' or 'link' type)
 * await model.mmList({ colId: 'link_col_id', parentRowId: record.id });
 * await model.addChild({ colId: 'link_col_id', rowId: record.id, childId: 'child_id' });
 * ```
 */
export function getBaseModel(params: GetBaseModelParams): BaseModelSql & LinkModelSql {
  const { type = 'json', ...rest } = params;

  switch (type) {
    case 'json':
      return new JSONModelSqlImp(rest);

    case 'link':
      return new JSONLinkModelSql(rest) as unknown as BaseModelSql & LinkModelSql;

    case 'lazyload':
      return new LazyloadLinkModelSql(rest);

    case 'copy':
      return new CopySqlImp(rest);

    default:
      return new JSONModelSqlImp(rest);
  }
}

/**
 * Get a link model instance (only link operations)
 *
 * @param params - Parameters for model creation
 * @returns LinkModelSql implementation
 */
export function getLinkModel(params: Omit<GetBaseModelParams, 'type'>): LinkModelSql {
  return new JSONLinkModelSql(params);
}

/**
 * Get a lazy loading model instance
 *
 * @param params - Parameters for model creation
 * @returns LazyloadLinkModelSql implementation
 */
export function getLazyloadModel(
  params: Omit<GetBaseModelParams, 'type'>
): LazyloadLinkModelSql {
  return new LazyloadLinkModelSql(params);
}

/**
 * Get a copy-enabled model instance
 *
 * @param params - Parameters for model creation
 * @returns CopySqlImp implementation
 */
export function getCopyModel(params: Omit<GetBaseModelParams, 'type'>): CopySqlImp {
  return new CopySqlImp(params);
}

// ========================================
// Database Setup
// ========================================

/**
 * Create the required database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are created
 *
 * @example
 * ```typescript
 * await createTables(knex);
 * ```
 */
export async function createTables(dbDriver: Knex): Promise<void> {
  // Create main data table
  const hasMainTable = await dbDriver.schema.hasTable('nc_bigtable');
  if (!hasMainTable) {
    await dbDriver.schema.createTable('nc_bigtable', (table) => {
      table.string('id').primary();
      table.string('fk_table_id').notNullable();
      table.timestamp('created_at').defaultTo(dbDriver.fn.now());
      table.timestamp('updated_at').defaultTo(dbDriver.fn.now());
      table.string('created_by');
      table.string('updated_by');
      table.jsonb('data');

      // Indexes
      table.index(['fk_table_id']);
      table.index(['fk_table_id', 'created_at']);
      table.index(['fk_table_id', 'updated_at']);
    });

    // Create GIN index for JSONB
    await dbDriver.raw(
      'CREATE INDEX IF NOT EXISTS idx_nc_bigtable_data ON nc_bigtable USING GIN(data)'
    );
  }

  // Create relations table
  const hasRelationsTable = await dbDriver.schema.hasTable('nc_bigtable_relations');
  if (!hasRelationsTable) {
    await dbDriver.schema.createTable('nc_bigtable_relations', (table) => {
      table.string('id').primary();
      table.string('fk_table_id').notNullable();
      table.string('fk_parent_id');
      table.string('fk_child_id');
      table.timestamp('created_at').defaultTo(dbDriver.fn.now());
      table.timestamp('updated_at').defaultTo(dbDriver.fn.now());

      // Indexes
      table.index(['fk_table_id', 'fk_parent_id']);
      table.index(['fk_table_id', 'fk_child_id']);
      table.index(['fk_table_id', 'fk_parent_id', 'fk_child_id']);
    });
  }
}

/**
 * Drop the database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are dropped
 */
export async function dropTables(dbDriver: Knex): Promise<void> {
  await dbDriver.schema.dropTableIfExists('nc_bigtable_relations');
  await dbDriver.schema.dropTableIfExists('nc_bigtable');
}

// ========================================
// Default Export
// ========================================

export default {
  getBaseModel,
  getLinkModel,
  getLazyloadModel,
  getCopyModel,
  createTables,
  dropTables,
};
