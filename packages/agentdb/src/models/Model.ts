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
  SchemaDescription,
  TableOverview,
  RelationshipInfo,
  RelationType,
  BulkWriteOperation,
  BulkWriteResult,
  BulkWriteOperationResult,
} from '../types';
import { UITypes } from '../types';
import { getColumnsWithPk } from '../utils/columnUtils';
import { parseFields } from '../utils/columnUtils';
import { parseRow } from '../utils/rowParser';
import { parseSimpleFilter, parseSimpleSort } from '../utils/filterParser';
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
  
  // === AI-friendly schema description ===
  
  /**
   * Get complete schema description for current table
   * Helps AI understand table structure, columns, and relationships
   */
  describeSchema(): SchemaDescription;
  
  /**
   * Get overview of all available tables
   * Helps AI understand the data model
   */
  describeAllTables(): TableOverview[];
  
  // === Transaction helpers ===
  
  /**
   * Execute operations atomically within a transaction
   * Automatically commits on success, rolls back on failure
   * 
   * @example
   * await model.atomic(async (m) => {
   *   const user = await m.insert({ name: 'John' });
   *   await m.links?.mmLink(col, ['order1'], user.id);
   *   return user;
   * });
   */
  atomic<T>(fn: (model: IModel) => Promise<T>): Promise<T>;
  
  /**
   * Execute mixed bulk operations atomically
   * 
   * @example
   * await model.bulkWrite([
   *   { op: 'insert', data: { name: 'A' } },
   *   { op: 'update', id: 'xxx', data: { status: 'active' } },
   *   { op: 'delete', id: 'yyy' }
   * ]);
   */
  bulkWrite(operations: BulkWriteOperation[]): Promise<BulkWriteResult>;
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
  // Schema Description (AI-friendly)
  // ==========================================================================

  /**
   * Get complete schema description for current table
   */
  describeSchema(): SchemaDescription {
    const table = this.context.table;
    const columns = table.columns || [];
    
    return {
      table: {
        id: table.id,
        title: table.title,
        description: table.description,
        hints: table.hints,
      },
      columns: columns.map((col) => ({
        id: col.id,
        title: col.title,
        type: col.uidt as string,
        description: col.description,
        required: col.required || col.constraints?.required || false,
        examples: col.examples,
        constraints: col.constraints,
      })),
      relationships: this.extractRelationships(table, columns),
    };
  }

  /**
   * Get overview of all available tables
   */
  describeAllTables(): TableOverview[] {
    return this.context.tables.map((t) => {
      const columns = t.columns || [];
      const linkColumns = columns.filter(
        (c) => c.uidt === UITypes.Links || c.uidt === UITypes.LinkToAnotherRecord
      );
      
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        columnCount: columns.length,
        relationCount: linkColumns.length,
      };
    });
  }

  /**
   * Extract relationship information from link columns
   */
  protected extractRelationships(table: Table, columns: Column[]): RelationshipInfo[] {
    const relationships: RelationshipInfo[] = [];
    
    for (const col of columns) {
      if (col.uidt !== UITypes.Links && col.uidt !== UITypes.LinkToAnotherRecord) {
        continue;
      }
      
      const options = col.colOptions || col.options;
      if (!options) continue;
      
      const opts = typeof options === 'string' ? JSON.parse(options) : options;
      const relatedTableId = opts?.fk_related_model_id;
      
      if (!relatedTableId) continue;
      
      const relatedTable = this.context.tables.find((t) => t.id === relatedTableId);
      if (!relatedTable) continue;
      
      // Determine relationship type
      let type: RelationType = 'mm';
      if (opts?.type === 'hm') type = 'hm';
      else if (opts?.type === 'bt') type = 'bt';
      
      relationships.push({
        columnId: col.id,
        columnTitle: col.title,
        relatedTableId: relatedTable.id,
        relatedTableTitle: relatedTable.title,
        type,
        description: col.description,
      });
    }
    
    return relationships;
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
  // Transaction Helpers (AI-friendly)
  // ==========================================================================

  /**
   * Execute operations atomically within a transaction
   * Automatically commits on success, rolls back on failure
   */
  async atomic<T>(fn: (model: IModel) => Promise<T>): Promise<T> {
    return this.context.db.transaction(async (trx) => {
      // Create a new model instance with the transaction context
      const atomicModel = this.createAtomicModel(trx);
      return fn(atomicModel);
    });
  }

  /**
   * Execute mixed bulk operations atomically
   */
  async bulkWrite(operations: BulkWriteOperation[]): Promise<BulkWriteResult> {
    const result: BulkWriteResult = {
      success: true,
      results: [],
      insertedIds: [],
      updatedCount: 0,
      deletedCount: 0,
      linkedCount: 0,
      unlinkedCount: 0,
    };

    if (operations.length === 0) {
      return result;
    }

    try {
      await this.context.db.transaction(async (trx) => {
        for (const op of operations) {
          const opResult = await this.executeWriteOperation(op, trx);
          result.results.push(opResult);
          
          if (!opResult.success) {
            result.success = false;
            throw new Error(opResult.error || 'Operation failed');
          }
          
          // Update counts
          switch (op.op) {
            case 'insert':
              if (opResult.id) result.insertedIds.push(opResult.id);
              break;
            case 'update':
              result.updatedCount++;
              break;
            case 'delete':
              result.deletedCount++;
              break;
            case 'link':
              result.linkedCount += op.childIds.length;
              break;
            case 'unlink':
              result.unlinkedCount += op.childIds.length;
              break;
          }
        }
      });
    } catch (error) {
      result.success = false;
    }

    return result;
  }

  /**
   * Create a model instance that uses a transaction
   */
  protected createAtomicModel(trx: Knex.Transaction): IModel {
    // Create a proxy that wraps write operations with the transaction
    const self = this;
    
    return {
      ...this,
      context: this.context,
      options: this.options,
      links: this.linkOps,
      virtual: this.virtualOps,
      lazy: this.lazyOps,
      copy: this.copyOps,
      
      // Override write operations to use transaction
      async insert(data: Record, _trx?: Knex.Transaction, ctx?: RequestContext) {
        return self.crudOps.insert(data, trx, ctx);
      },
      async updateByPk(id: string, data: Record, _trx?: Knex.Transaction, ctx?: RequestContext) {
        return self.crudOps.updateByPk(id, data, trx, ctx);
      },
      async deleteByPk(id: string, _trx?: Knex.Transaction, ctx?: RequestContext) {
        return self.crudOps.deleteByPk(id, trx, ctx);
      },
      async bulkInsert(data: Record[], options?: BulkOptions) {
        return self.crudOps.bulkInsert(data, { ...options, trx });
      },
      async bulkUpdate(data: Record[], options?: BulkOptions) {
        return self.crudOps.bulkUpdate(data, { ...options, trx });
      },
      async bulkDelete(ids: string[], options?: BulkOptions) {
        return self.crudOps.bulkDelete(ids, { ...options, trx });
      },
      
      // Read operations pass through (no transaction needed)
      readByPk: self.readByPk.bind(self),
      exists: self.exists.bind(self),
      findOne: self.findOne.bind(self),
      list: self.list.bind(self),
      count: self.count.bind(self),
      groupBy: self.groupBy.bind(self),
      bulkUpdateAll: self.bulkUpdateAll.bind(self),
      bulkDeleteAll: self.bulkDeleteAll.bind(self),
      getQueryBuilder: self.getQueryBuilder.bind(self),
      getInsertBuilder: self.getInsertBuilder.bind(self),
      describeSchema: self.describeSchema.bind(self),
      describeAllTables: self.describeAllTables.bind(self),
      atomic: self.atomic.bind(self),
      bulkWrite: self.bulkWrite.bind(self),
    } as IModel;
  }

  /**
   * Execute a single write operation
   */
  protected async executeWriteOperation(
    op: BulkWriteOperation,
    trx: Knex.Transaction
  ): Promise<BulkWriteOperationResult> {
    try {
      switch (op.op) {
        case 'insert': {
          const record = await this.crudOps.insert(op.data, trx);
          return { op: 'insert', success: true, id: record.id as string };
        }
        case 'update': {
          await this.crudOps.updateByPk(op.id, op.data, trx);
          return { op: 'update', success: true, id: op.id };
        }
        case 'delete': {
          await this.crudOps.deleteByPk(op.id, trx);
          return { op: 'delete', success: true, id: op.id };
        }
        case 'link': {
          if (!this.linkOps) {
            return { op: 'link', success: false, error: 'Link operations not enabled' };
          }
          const column = getColumnsWithPk(this.context.table).find((c) => c.id === op.columnId);
          if (!column) {
            return { op: 'link', success: false, error: `Column not found: ${op.columnId}` };
          }
          await this.linkOps.mmLink(column, op.childIds, op.parentId, trx);
          return { op: 'link', success: true };
        }
        case 'unlink': {
          if (!this.linkOps) {
            return { op: 'unlink', success: false, error: 'Link operations not enabled' };
          }
          const column = getColumnsWithPk(this.context.table).find((c) => c.id === op.columnId);
          if (!column) {
            return { op: 'unlink', success: false, error: `Column not found: ${op.columnId}` };
          }
          await this.linkOps.mmUnlink(column, op.childIds, op.parentId, trx);
          return { op: 'unlink', success: true };
        }
        default:
          return { op: (op as BulkWriteOperation).op, success: false, error: 'Unknown operation' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { op: op.op, success: false, error: message };
    }
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

  /**
   * Normalize ListArgs: convert simplified filter/sortBy to filterArr/sortArr
   */
  protected normalizeArgs(args: ListArgs): ListArgs {
    const normalized = { ...args };
    
    // Convert simplified filter to filterArr
    if (args.filter && !args.filterArr?.length) {
      normalized.filterArr = parseSimpleFilter(args.filter, this.context.table);
    }
    
    // Convert simplified sortBy to sortArr
    if (args.sortBy && !args.sortArr?.length) {
      normalized.sortArr = parseSimpleSort(args.sortBy, this.context.table);
    }
    
    return normalized;
  }

  protected async applyFiltersAndSorts(
    qb: Knex.QueryBuilder,
    args: ListArgs
  ): Promise<void> {
    // Normalize args first (convert simplified syntax)
    const normalizedArgs = this.normalizeArgs(args);
    
    if (normalizedArgs.filterArr?.length) {
      await applyConditions(
        normalizedArgs.filterArr,
        qb,
        this.context.table,
        this.context.tables,
        this.context.db
      );
    }
    if (normalizedArgs.where) {
      const filters = parseWhereString(normalizedArgs.where, this.context.table);
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

    if (normalizedArgs.sortArr?.length) {
      await applySorts(
        normalizedArgs.sortArr,
        qb,
        this.context.table,
        this.context.tables,
        this.context.db,
        this.context.alias
      );
    }
    if (normalizedArgs.sort) {
      const sorts = parseSortString(normalizedArgs.sort, this.context.table);
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
