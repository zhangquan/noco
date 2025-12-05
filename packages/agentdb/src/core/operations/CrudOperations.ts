/**
 * CRUD operations module
 * @module core/operations/CrudOperations
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { IModelContext } from '../ModelContext';
import { NcError } from '../NcError';
import type { Column, Table, ListArgs, GroupByArgs, BulkOptions, RequestContext, Record } from '../../types';
import { UITypes, getColumnName } from '../../types';
import { TABLE_DATA } from '../../config';
import { sanitize } from '../../utils/sanitize';
import {
  isSystemColumn,
  isVirtualColumn,
  getColumnsWithPk,
  parseFields,
} from '../../utils/columnUtils';
import { parseRow } from '../../utils/rowParser';
import {
  createQueryBuilder,
  createInsertBuilder,
  buildSelectExpressions,
  applyPagination,
  buildPkWhere,
  getColumnExpression,
} from '../../query/sqlBuilder';
import { applyConditions, parseWhereString } from '../../query/conditionBuilder';
import { applySorts, parseSortString } from '../../query/sortBuilder';

// ============================================================================
// CRUD Operations Interface
// ============================================================================

export interface ICrudOperations {
  // Read
  readByPk(id: string, fields?: string | string[]): Promise<Record | null>;
  exists(id: string): Promise<boolean>;
  findOne(args: ListArgs): Promise<Record | null>;

  // List
  list(args?: ListArgs, ignoreFilterSort?: boolean): Promise<Record[]>;
  count(args?: ListArgs, ignoreFilterSort?: boolean): Promise<number>;

  // Write
  insert(data: Record, trx?: Knex.Transaction, ctx?: RequestContext): Promise<Record>;
  updateByPk(id: string, data: Record, trx?: Knex.Transaction, ctx?: RequestContext): Promise<Record>;
  deleteByPk(id: string, trx?: Knex.Transaction, ctx?: RequestContext): Promise<number>;

  // Bulk
  bulkInsert(data: Record[], options?: BulkOptions): Promise<Record[]>;
  bulkUpdate(data: Record[], options?: BulkOptions): Promise<Record[]>;
  bulkUpdateAll(args: ListArgs, data: Record, options?: BulkOptions): Promise<number>;
  bulkDelete(ids: string[], options?: BulkOptions): Promise<number>;
  bulkDeleteAll(args?: ListArgs, options?: BulkOptions): Promise<number>;

  // Aggregation
  groupBy(args: GroupByArgs): Promise<Record[]>;

  // Query builders
  getQueryBuilder(): Knex.QueryBuilder;
  getInsertBuilder(): Knex.QueryBuilder;
}

// ============================================================================
// CRUD Operations Class
// ============================================================================

/**
 * CRUD operations implementation
 */
export class CrudOperations implements ICrudOperations {
  constructor(protected readonly ctx: IModelContext) {}

  // ==========================================================================
  // Query Builders
  // ==========================================================================

  getQueryBuilder(): Knex.QueryBuilder {
    return createQueryBuilder(this.ctx.db, this.ctx.table, this.ctx.alias);
  }

  getInsertBuilder(): Knex.QueryBuilder {
    return createInsertBuilder(this.ctx.db, this.ctx.table);
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async readByPk(id: string, fields?: string | string[]): Promise<Record | null> {
    const qb = this.getQueryBuilder();
    await this.buildSelect(qb, fields);
    qb.where(buildPkWhere(this.ctx.table, id, this.ctx.alias));
    qb.limit(1);

    const result = await this.executeQuery<Record[]>(qb);
    return result.length > 0 ? result[0] : null;
  }

  async exists(id: string): Promise<boolean> {
    const qb = this.getQueryBuilder();
    qb.select(this.ctx.db.raw('1'));
    qb.where(buildPkWhere(this.ctx.table, id, this.ctx.alias));
    qb.limit(1);

    const result = await qb;
    return result.length > 0;
  }

  async findOne(args: ListArgs): Promise<Record | null> {
    const results = await this.list({ ...args, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  // ==========================================================================
  // List Operations
  // ==========================================================================

  async list(args: ListArgs = {}, ignoreFilterSort = false): Promise<Record[]> {
    const qb = this.getQueryBuilder();
    await this.buildSelect(qb, args.fields);

    if (!ignoreFilterSort) {
      await this.applyFiltersAndSorts(qb, args);
    }

    applyPagination(qb, args.limit, args.offset, this.ctx.config);

    return this.executeQuery<Record[]>(qb);
  }

  async count(args: ListArgs = {}, ignoreFilterSort = false): Promise<number> {
    const qb = this.getQueryBuilder();
    qb.count('* as count');

    if (!ignoreFilterSort) {
      await this.applyFilters(qb, args);
    }

    const result = await qb;
    return parseInt(result[0]?.count || '0', 10);
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  async insert(
    data: Record,
    trx?: Knex.Transaction,
    reqCtx?: RequestContext
  ): Promise<Record> {
    const sanitized = sanitize(data) as Record;
    this.populatePk(sanitized);

    const mapped = this.mapDataForInsert(sanitized, reqCtx);

    const qb = this.getInsertBuilder();
    if (trx) qb.transacting(trx);

    await qb.insert(mapped);

    return this.readByPk(mapped.id as string) as Promise<Record>;
  }

  async updateByPk(
    id: string,
    data: Record,
    trx?: Knex.Transaction,
    reqCtx?: RequestContext
  ): Promise<Record> {
    const existing = await this.readByPk(id);
    if (!existing) {
      NcError.recordNotFound(id, this.ctx.table.title);
    }

    const sanitized = sanitize(data) as Record;
    const merged = { ...existing, ...sanitized };
    const mapped = this.mapDataForUpdate(merged, reqCtx);

    const qb = this.ctx.db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.where('id', id);
    qb.where('table_id', this.ctx.table.id);
    await qb.update(mapped);

    return this.readByPk(id) as Promise<Record>;
  }

  async deleteByPk(
    id: string,
    trx?: Knex.Transaction,
    reqCtx?: RequestContext
  ): Promise<number> {
    const exists = await this.exists(id);
    if (!exists) {
      NcError.recordNotFound(id, this.ctx.table.title);
    }

    const qb = this.ctx.db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.where('id', id);
    qb.where('table_id', this.ctx.table.id);

    return qb.delete();
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  async bulkInsert(data: Record[], options: BulkOptions = {}): Promise<Record[]> {
    const { chunkSize = 100, cookie, trx } = options;

    const executeInserts = async (transaction?: Knex.Transaction): Promise<Record[]> => {
      const allIds: string[] = [];
      const chunks = this.chunk(data, chunkSize);

      for (const batch of chunks) {
        // Prepare all records for batch insert
        const mappedBatch = batch.map((item) => {
          const sanitized = sanitize(item) as Record;
          this.populatePk(sanitized);
          return this.mapDataForInsert(sanitized, cookie);
        });

        // Batch insert
        const qb = this.getInsertBuilder();
        if (transaction) qb.transacting(transaction);
        await qb.insert(mappedBatch);

        // Collect IDs
        allIds.push(...mappedBatch.map((r) => r.id as string));
      }

      // Fetch all inserted records in one query
      if (allIds.length === 0) return [];

      const qb = this.getQueryBuilder();
      await this.buildSelect(qb);
      qb.whereIn(`${TABLE_DATA}.id`, allIds);
      
      return this.executeQuery<Record[]>(qb);
    };

    if (trx) {
      return executeInserts(trx);
    }

    return this.ctx.db.transaction((tx) => executeInserts(tx));
  }

  async bulkUpdate(data: Record[], options: BulkOptions = {}): Promise<Record[]> {
    const { cookie, trx, chunkSize = 100 } = options;

    const executeUpdates = async (transaction?: Knex.Transaction): Promise<Record[]> => {
      const updatedIds: string[] = [];
      const chunks = this.chunk(data, chunkSize);

      for (const batch of chunks) {
        // Process each item in the batch
        await Promise.all(
          batch.map(async (item) => {
            const id = (item.id || item.Id) as string;
            if (!id) return;

            const existing = await this.readByPk(id);
            if (!existing) return;

            const sanitized = sanitize(item) as Record;
            const merged = { ...existing, ...sanitized };
            const mapped = this.mapDataForUpdate(merged, cookie);

            const qb = this.ctx.db(TABLE_DATA);
            if (transaction) qb.transacting(transaction);
            qb.where('id', id);
            qb.where('table_id', this.ctx.table.id);
            await qb.update(mapped);

            updatedIds.push(id);
          })
        );
      }

      // Fetch all updated records in one query
      if (updatedIds.length === 0) return [];

      const qb = this.getQueryBuilder();
      await this.buildSelect(qb);
      qb.whereIn(`${TABLE_DATA}.id`, updatedIds);

      return this.executeQuery<Record[]>(qb);
    };

    if (trx) {
      return executeUpdates(trx);
    }

    return this.ctx.db.transaction((tx) => executeUpdates(tx));
  }

  async bulkUpdateAll(
    args: ListArgs,
    data: Record,
    options: BulkOptions = {}
  ): Promise<number> {
    const { cookie, trx } = options;

    const records = await this.list({ ...args, fields: ['id'] });
    const ids = records.map((r) => r.id).filter(Boolean) as string[];

    if (ids.length === 0) return 0;

    const sanitized = sanitize(data) as Record;
    const mapped = this.mapDataForUpdate(sanitized, cookie);

    const qb = this.ctx.db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.whereIn('id', ids);
    qb.where('table_id', this.ctx.table.id);

    await qb.update(mapped);

    return ids.length;
  }

  async bulkDelete(ids: string[], options: BulkOptions = {}): Promise<number> {
    const { trx } = options;

    if (ids.length === 0) return 0;

    const qb = this.ctx.db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.whereIn('id', ids);
    qb.where('table_id', this.ctx.table.id);

    return qb.delete();
  }

  async bulkDeleteAll(args: ListArgs = {}, options: BulkOptions = {}): Promise<number> {
    const records = await this.list({ ...args, fields: ['id'] });
    const ids = records.map((r) => r.id).filter(Boolean) as string[];

    return this.bulkDelete(ids, options);
  }

  // ==========================================================================
  // Aggregation
  // ==========================================================================

  async groupBy(args: GroupByArgs): Promise<Record[]> {
    const { columnId, aggregation = 'count' } = args;
    const column = getColumnsWithPk(this.ctx.table).find(
      (c) => c.id === columnId || getColumnName(c) === columnId || c.title === columnId
    );

    if (!column) return [];

    const sqlCol = getColumnExpression(column, this.ctx.table, this.ctx.alias);
    const displayName = column.title || getColumnName(column);
    const qb = this.getQueryBuilder();

    qb.select(this.ctx.db.raw(`${sqlCol} as "${displayName}"`));

    switch (aggregation.toLowerCase()) {
      case 'count': qb.count('* as count'); break;
      case 'sum': qb.sum(`${sqlCol} as sum`); break;
      case 'avg': qb.avg(`${sqlCol} as avg`); break;
      case 'min': qb.min(`${sqlCol} as min`); break;
      case 'max': qb.max(`${sqlCol} as max`); break;
      default: qb.count('* as count');
    }

    qb.groupBy(this.ctx.db.raw(sqlCol));
    await this.applyFiltersAndSorts(qb, args);
    applyPagination(qb, args.limit, args.offset, this.ctx.config);

    return this.executeQuery<Record[]>(qb);
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected async buildSelect(qb: Knex.QueryBuilder, fields?: string | string[]): Promise<void> {
    const columns = parseFields(fields, this.ctx.table);
    const selects = buildSelectExpressions(columns, this.ctx.table, this.ctx.alias, this.ctx.db);
    qb.select(selects);
  }

  protected async applyFilters(qb: Knex.QueryBuilder, args: ListArgs): Promise<void> {
    if (args.filterArr?.length) {
      await applyConditions(args.filterArr, qb, this.ctx.table, this.ctx.tables, this.ctx.db);
    }
    if (args.where) {
      const filters = parseWhereString(args.where, this.ctx.table);
      if (filters.length) {
        await applyConditions(filters, qb, this.ctx.table, this.ctx.tables, this.ctx.db);
      }
    }
  }

  protected async applyFiltersAndSorts(qb: Knex.QueryBuilder, args: ListArgs): Promise<void> {
    await this.applyFilters(qb, args);

    if (args.sortArr?.length) {
      await applySorts(args.sortArr, qb, this.ctx.table, this.ctx.tables, this.ctx.db, this.ctx.alias);
    }
    if (args.sort) {
      const sorts = parseSortString(args.sort, this.ctx.table);
      if (sorts.length) {
        await applySorts(sorts, qb, this.ctx.table, this.ctx.tables, this.ctx.db, this.ctx.alias);
      }
    }
  }

  protected async executeQuery<T = Record[]>(qb: Knex.QueryBuilder): Promise<T> {
    try {
      // Apply timeout if configured
      if (this.ctx.config.queryTimeout > 0) {
        qb.timeout(this.ctx.config.queryTimeout, { cancel: true });
      }
      
      const result = await qb;
      if (Array.isArray(result)) {
        return result.map((row) => parseRow(row)) as T;
      }
      return result as T;
    } catch (error) {
      this.ctx.config.logger.error('Query execution error:', error);
      throw error;
    }
  }

  protected populatePk(data: Record): void {
    if (!data.id) {
      data.id = ulid();
    }
  }

  protected mapDataForInsert(data: Record, reqCtx?: RequestContext): Record {
    const { system, userData } = this.separateSystemAndUserData(data, false);
    const now = new Date().toISOString();

    return {
      id: (system.id as string) || ulid(),
      table_id: this.ctx.table.id,
      created_at: (system.created_at as string) || now,
      updated_at: (system.updated_at as string) || now,
      created_by: (system.created_by as string | null) ?? reqCtx?.user?.id ?? null,
      updated_by: (system.updated_by as string | null) ?? reqCtx?.user?.id ?? null,
      data: JSON.stringify(userData),
    };
  }

  protected mapDataForUpdate(data: Record, reqCtx?: RequestContext): Record {
    const { userData } = this.separateSystemAndUserData(data, true);

    return {
      updated_at: new Date().toISOString(),
      updated_by: reqCtx?.user?.id ?? null,
      data: JSON.stringify(userData),
    };
  }

  protected separateSystemAndUserData(
    data: Record,
    isUpdate: boolean
  ): { system: Record; userData: Record } {
    const system: Record = {};
    const userData: Record = {};
    const columns = getColumnsWithPk(this.ctx.table);

    for (const [key, value] of Object.entries(data)) {
      const column = columns.find(
        (c) => c.id === key || c.title === key || getColumnName(c) === key
      );

      if (!column) {
        userData[key] = value;
        continue;
      }

      if (isVirtualColumn(column)) continue;

      if (isSystemColumn(column)) {
        if (column.uidt === UITypes.ID) {
          system.id = value as string;
        } else if (column.uidt === UITypes.CreatedTime && !isUpdate) {
          system.created_at = value as string;
        } else if (column.uidt === UITypes.LastModifiedTime) {
          system.updated_at = value as string;
        } else if (column.uidt === UITypes.CreatedBy && !isUpdate) {
          system.created_by = value as string | null;
        } else if (column.uidt === UITypes.LastModifiedBy) {
          system.updated_by = value as string | null;
        }
      } else {
        const colName = getColumnName(column);
        userData[colName] = this.convertValue(column, value);
      }
    }

    return { system, userData };
  }

  protected convertValue(column: Column, value: unknown): unknown {
    if (value === null || value === undefined) return null;

    switch (column.uidt) {
      case UITypes.Checkbox:
        return Boolean(value);

      case UITypes.Number:
      case UITypes.Decimal:
      case UITypes.Currency:
      case UITypes.Percent:
      case UITypes.Rating:
      case UITypes.AutoNumber:
        if (typeof value === 'string') {
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        }
        return value;

      case UITypes.JSON:
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;

      case UITypes.MultiSelect:
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value.split(',').map((v) => v.trim());
          }
        }
        return [value];

      default:
        return value;
    }
  }

  protected chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Create CRUD operations for a context
 */
export function createCrudOperations(ctx: IModelContext): CrudOperations {
  return new CrudOperations(ctx);
}
