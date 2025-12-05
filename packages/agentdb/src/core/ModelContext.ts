/**
 * Model context - shared state for all operations
 * @module core/ModelContext
 */

import type { Knex } from 'knex';
import type { Table, Record } from '../types';
import { NcError } from './NcError';
import { ModelConfig, DEFAULT_MODEL_CONFIG } from '../config';

// ============================================================================
// Context Interface
// ============================================================================

/**
 * Model context interface - shared state for all operations
 */
export interface IModelContext {
  /** Knex database instance */
  readonly db: Knex;
  /** Current table ID */
  readonly tableId: string;
  /** Current view ID */
  readonly viewId?: string;
  /** All table definitions */
  readonly tables: Table[];
  /** Current table definition */
  readonly table: Table;
  /** Table alias for queries */
  readonly alias?: string;
  /** Model configuration */
  readonly config: ModelConfig;
}

/**
 * Model context creation parameters
 */
export interface ModelContextParams {
  db: Knex;
  tableId: string;
  tables: Table[];
  viewId?: string;
  alias?: string;
  config?: Partial<ModelConfig>;
}

// ============================================================================
// ModelContext Class
// ============================================================================

/**
 * Model context - immutable shared state for all operations
 */
export class ModelContext implements IModelContext {
  readonly db: Knex;
  readonly tableId: string;
  readonly viewId?: string;
  readonly tables: Table[];
  readonly table: Table;
  readonly alias?: string;
  readonly config: ModelConfig;

  constructor(params: ModelContextParams) {
    this.db = params.db;
    this.tableId = params.tableId;
    this.viewId = params.viewId;
    this.tables = params.tables;
    this.alias = params.alias;
    this.config = { ...DEFAULT_MODEL_CONFIG, ...params.config };

    // Find and validate table
    const table = params.tables.find((t) => t.id === params.tableId);
    if (!table) {
      NcError.tableNotFound(params.tableId);
    }
    this.table = table!;
  }

  /**
   * Create a new context with different table
   */
  withTable(tableId: string): ModelContext {
    return new ModelContext({
      db: this.db,
      tableId,
      tables: this.tables,
      viewId: undefined,
      alias: undefined,
      config: this.config,
    });
  }

  /**
   * Create a new context with alias
   */
  withAlias(alias: string): ModelContext {
    return new ModelContext({
      db: this.db,
      tableId: this.tableId,
      tables: this.tables,
      viewId: this.viewId,
      alias,
      config: this.config,
    });
  }
}

/**
 * Create a model context
 */
export function createContext(params: ModelContextParams): ModelContext {
  return new ModelContext(params);
}
