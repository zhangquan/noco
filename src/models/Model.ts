/**
 * Model class using composition pattern
 * @module models/Model
 */

import type { Knex } from 'knex';
import {
  ModelContext,
  createContext,
  type IModelContext,
  type ModelContextParams,
} from '../core/ModelContext';
import {
  CrudOperations,
  LinkOperations,
  VirtualColumnOperations,
  LazyOperations,
  CopyOperations,
  type ICrudOperations,
  type ILinkOperations,
  type IVirtualColumnOperations,
  type ILazyOperations,
  type ICopyOperations,
  type CopyOptions,
  type CopyRelationOptions,
} from '../core/operations';
import type {
  Column,
  Table,
  ListArgs,
  GroupByArgs,
  BulkOptions,
  RequestContext,
  Record,
} from '../types';
import { parseFields } from '../utils/columnUtils';
import { parseRow } from '../utils/rowParser';
import { buildSelectExpressions, buildPkWhere, applyPagination } from '../query/sqlBuilder';
import { applyConditions, parseWhereString } from '../query/conditionBuilder';
import { applySorts, parseSortString } from '../query/sortBuilder';

// ============================================================================
// Model Options
// ============================================================================

export interface ModelOptions {
  /** Enable virtual column support (Formula, Rollup, Lookup, Links) */
  virtualColumns?: boolean;
  /** Enable lazy loading for relations */
  lazyLoading?: boolean;
  /** Enable deep copy operations */
  copyOperations?: boolean;
  /** Enable link operations */
  linkOperations?: boolean;
}

const DEFAULT_OPTIONS: ModelOptions = {
  virtualColumns: true,
  lazyLoading: false,
  copyOperations: false,
  linkOperations: true,
};

// ============================================================================
// Model Interface
// ============================================================================

export interface IModel extends ICrudOperations {
  readonly context: IModelContext;
  readonly options: ModelOptions;
  
  // Link operations (optional)
  readonly links?: ILinkOperations;
  
  // Virtual column operations (optional)
  readonly virtual?: IVirtualColumnOperations;
  
  // Lazy loading operations (optional)
  readonly lazy?: ILazyOperations;
  
  // Copy operations (optional)
  readonly copy?: ICopyOperations;
}

// ============================================================================
// Model Class
// ============================================================================

/**
 * Main model class using composition pattern
 * Composes operations based on options
 */
export class Model implements IModel {
  readonly context: IModelContext;
  readonly options: ModelOptions;

  // Core operations
  protected readonly crudOps: CrudOperations;
  
  // Optional operations
  protected readonly linkOps?: LinkOperations;
  protected readonly virtualOps?: VirtualColumnOperations;
  protected readonly lazyOps?: LazyOperations;
  protected readonly copyOps?: CopyOperations;

  constructor(params: ModelContextParams, options: ModelOptions = {}) {
    this.context = createContext(params);
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize core operations
    this.crudOps = new CrudOperations(this.context);

    // Initialize optional operations based on options
    if (this.options.linkOperations) {
      this.linkOps = new LinkOperations(this.context, this.crudOps);
    }

    if (this.options.virtualColumns) {
      this.virtualOps = new VirtualColumnOperations(this.context);
    }

    if (this.options.lazyLoading && this.linkOps) {
      this.lazyOps = new LazyOperations(this.context, this.crudOps, this.linkOps);
    }

    if (this.options.copyOperations && this.linkOps) {
      this.copyOps = new CopyOperations(this.context, this.crudOps, this.linkOps);
    }
  }

  // ==========================================================================
  // Accessors for Optional Operations
  // ==========================================================================

  get links(): ILinkOperations | undefined {
    return this.linkOps;
  }

  get virtual(): IVirtualColumnOperations | undefined {
    return this.virtualOps;
  }

  get lazy(): ILazyOperations | undefined {
    return this.lazyOps;
  }

  get copy(): ICopyOperations | undefined {
    return this.copyOps;
  }

  // ==========================================================================
  // Query Builders
  // ==========================================================================

  getQueryBuilder(): Knex.QueryBuilder {
    return this.crudOps.getQueryBuilder();
  }

  getInsertBuilder(): Knex.QueryBuilder {
    return this.crudOps.getInsertBuilder();
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async readByPk(id: string, fields?: string | string[]): Promise<Record | null> {
    const qb = this.crudOps.getQueryBuilder();
    await this.buildSelectWithVirtual(qb, fields);
    
    qb.where(buildPkWhere(this.context.table, id, this.context.alias));
    qb.limit(1);

    const result = await this.executeQuery<Record[]>(qb);
    return result.length > 0 ? result[0] : null;
  }

  async exists(id: string): Promise<boolean> {
    return this.crudOps.exists(id);
  }

  async findOne(args: ListArgs): Promise<Record | null> {
    const results = await this.list({ ...args, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // ==========================================================================
  // List Operations
  // ==========================================================================

  async list(args: ListArgs = {}, ignoreFilterSort = false): Promise<Record[]> {
    const qb = this.crudOps.getQueryBuilder();
    await this.buildSelectWithVirtual(qb, args.fields);

    if (!ignoreFilterSort) {
      await this.applyFiltersAndSorts(qb, args);
    }

    applyPagination(qb, args.limit, args.offset, this.context.config);

    return this.executeQuery<Record[]>(qb);
  }

  async count(args: ListArgs = {}, ignoreFilterSort = false): Promise<number> {
    return this.crudOps.count(args, ignoreFilterSort);
  }

  // ==========================================================================
  // Write Operations (delegated to CRUD ops)
  // ==========================================================================

  async insert(
    data: Record,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<Record> {
    return this.crudOps.insert(data, trx, ctx);
  }

  async updateByPk(
    id: string,
    data: Record,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<Record> {
    return this.crudOps.updateByPk(id, data, trx, ctx);
  }

  async deleteByPk(
    id: string,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<number> {
    return this.crudOps.deleteByPk(id, trx, ctx);
  }

  // ==========================================================================
  // Bulk Operations (delegated to CRUD ops)
  // ==========================================================================

  async bulkInsert(data: Record[], options?: BulkOptions): Promise<Record[]> {
    return this.crudOps.bulkInsert(data, options);
  }

  async bulkUpdate(data: Record[], options?: BulkOptions): Promise<Record[]> {
    return this.crudOps.bulkUpdate(data, options);
  }

  async bulkUpdateAll(args: ListArgs, data: Record, options?: BulkOptions): Promise<number> {
    return this.crudOps.bulkUpdateAll(args, data, options);
  }

  async bulkDelete(ids: string[], options?: BulkOptions): Promise<number> {
    return this.crudOps.bulkDelete(ids, options);
  }

  async bulkDeleteAll(args?: ListArgs, options?: BulkOptions): Promise<number> {
    return this.crudOps.bulkDeleteAll(args, options);
  }

  // ==========================================================================
  // Aggregation (delegated to CRUD ops)
  // ==========================================================================

  async groupBy(args: GroupByArgs): Promise<Record[]> {
    return this.crudOps.groupBy(args);
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected async buildSelectWithVirtual(
    qb: Knex.QueryBuilder,
    fields?: string | string[]
  ): Promise<void> {
    const columns = parseFields(fields, this.context.table);
    const selects = buildSelectExpressions(
      columns,
      this.context.table,
      this.context.alias,
      this.context.db
    );
    qb.select(selects);

    // Add virtual column selects if enabled
    if (this.virtualOps) {
      await this.virtualOps.buildVirtualSelects(qb);
    }
  }

  protected async applyFiltersAndSorts(
    qb: Knex.QueryBuilder,
    args: ListArgs
  ): Promise<void> {
    if (args.filterArr?.length) {
      await applyConditions(
        args.filterArr,
        qb,
        this.context.table,
        this.context.tables,
        this.context.db
      );
    }
    if (args.where) {
      const filters = parseWhereString(args.where, this.context.table);
      if (filters.length) {
        await applyConditions(
          filters,
          qb,
          this.context.table,
          this.context.tables,
          this.context.db
        );
      }
    }

    if (args.sortArr?.length) {
      await applySorts(
        args.sortArr,
        qb,
        this.context.table,
        this.context.tables,
        this.context.db,
        this.context.alias
      );
    }
    if (args.sort) {
      const sorts = parseSortString(args.sort, this.context.table);
      if (sorts.length) {
        await applySorts(
          sorts,
          qb,
          this.context.table,
          this.context.tables,
          this.context.db,
          this.context.alias
        );
      }
    }
  }

  protected async executeQuery<T = Record[]>(qb: Knex.QueryBuilder): Promise<T> {
    try {
      // Apply timeout if configured
      if (this.context.config.queryTimeout > 0) {
        qb.timeout(this.context.config.queryTimeout, { cancel: true });
      }

      const result = await qb;
      if (Array.isArray(result)) {
        return result.map((row) => parseRow(row)) as T;
      }
      return result as T;
    } catch (error) {
      this.context.config.logger.error('Query execution error:', error);
      throw error;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a model with default options
 */
export function createModel(params: ModelContextParams): Model {
  return new Model(params, {
    virtualColumns: true,
    linkOperations: true,
    lazyLoading: false,
    copyOperations: false,
  });
}

/**
 * Create a model with lazy loading enabled
 */
export function createLazyModel(params: ModelContextParams): Model {
  return new Model(params, {
    virtualColumns: true,
    linkOperations: true,
    lazyLoading: true,
    copyOperations: false,
  });
}

/**
 * Create a model with copy operations enabled
 */
export function createCopyModel(params: ModelContextParams): Model {
  return new Model(params, {
    virtualColumns: true,
    linkOperations: true,
    lazyLoading: false,
    copyOperations: true,
  });
}

/**
 * Create a model with all features enabled
 */
export function createFullModel(params: ModelContextParams): Model {
  return new Model(params, {
    virtualColumns: true,
    linkOperations: true,
    lazyLoading: true,
    copyOperations: true,
  });
}

/**
 * Create a minimal model with only CRUD operations
 */
export function createMinimalModel(params: ModelContextParams): Model {
  return new Model(params, {
    virtualColumns: false,
    linkOperations: false,
    lazyLoading: false,
    copyOperations: false,
  });
}
