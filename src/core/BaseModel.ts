/**
 * Base model implementation
 * @module core/BaseModel
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { IBaseModel } from './interfaces';
import { NcError } from './NcError';
import type { Column, Table, ListArgs, GroupByArgs, BulkOptions, RequestContext, Record } from '../types';
import { UITypes } from '../types';
import { TABLE_DATA, ModelConfig, DEFAULT_MODEL_CONFIG } from '../config';
import { sanitize } from '../utils/sanitize';
import {
  isSystemColumn,
  isVirtualColumn,
  getColumnsWithPk,
  getPrimaryKeyOrDefault,
  getTableByIdOrThrow,
} from '../utils/columnUtils';
import {
  createQueryBuilder,
  createInsertBuilder,
  buildSelectExpressions,
  applyPagination,
  buildPkWhere,
} from '../query/sqlBuilder';
import { parseFields } from '../utils/columnUtils';
import { applyConditions, parseWhereString } from '../query/conditionBuilder';
import { applySorts, parseSortString } from '../query/sortBuilder';

// ============================================================================
// Base Model Class
// ============================================================================

/**
 * Base model implementation with CRUD operations
 */
export class BaseModel implements IBaseModel {
  protected readonly _db: Knex;
  protected readonly _tableId: string;
  protected readonly _viewId?: string;
  protected readonly _tables: Table[];
  protected readonly _table: Table;
  protected readonly _alias?: string;
  protected readonly _config: ModelConfig;

  constructor(params: {
    db: Knex;
    tableId: string;
    tables: Table[];
    viewId?: string;
    alias?: string;
    config?: Partial<ModelConfig>;
  }) {
    this._db = params.db;
    this._tableId = params.tableId;
    this._viewId = params.viewId;
    this._tables = params.tables;
    this._alias = params.alias;
    this._config = { ...DEFAULT_MODEL_CONFIG, ...params.config };

    const table = params.tables.find((t) => t.id === params.tableId);
    if (!table) {
      NcError.tableNotFound(params.tableId);
    }
    this._table = table!;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get db(): Knex {
    return this._db;
  }

  get tableId(): string {
    return this._tableId;
  }

  get viewId(): string | undefined {
    return this._viewId;
  }

  get tables(): Table[] {
    return this._tables;
  }

  get table(): Table {
    return this._table;
  }

  get alias(): string | undefined {
    return this._alias;
  }

  // ==========================================================================
  // Query Builders
  // ==========================================================================

  getQueryBuilder(): Knex.QueryBuilder {
    return createQueryBuilder(this._db, this._table, this._alias);
  }

  getInsertBuilder(): Knex.QueryBuilder {
    return createInsertBuilder(this._db, this._table);
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  async readByPk(id: string, fields?: string | string[]): Promise<Record | null> {
    const qb = this.getQueryBuilder();
    await this.buildSelect(qb, fields);
    qb.where(buildPkWhere(this._table, id, this._alias));
    qb.limit(1);

    const result = await this.executeQuery<Record[]>(qb);
    return result.length > 0 ? result[0] : null;
  }

  async exists(id: string): Promise<boolean> {
    const qb = this.getQueryBuilder();
    qb.select(this._db.raw('1'));
    qb.where(buildPkWhere(this._table, id as string, this._alias));
    qb.limit(1);

    const result = await qb;
    return result.length > 0;
  }

  async findOne(args: ListArgs): Promise<Record | null> {
    const results = await this.list({ ...args, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async insert(
    data: Record,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<Record> {
    const sanitized = sanitize(data) as Record;
    this.populatePk(sanitized);

    const mapped = this.mapDataForInsert(sanitized, ctx);

    const qb = this.getInsertBuilder();
    if (trx) qb.transacting(trx);

    await qb.insert(mapped);

    return this.readByPk(mapped.id as string) as Promise<Record>;
  }

  async updateByPk(
    id: string,
    data: Record,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<Record> {
    const existing = await this.readByPk(id);
    if (!existing) {
      NcError.recordNotFound(id, this._table.title);
    }

    const sanitized = sanitize(data) as Record;
    const merged = { ...existing, ...sanitized };
    const mapped = this.mapDataForUpdate(merged, ctx);

    const qb = this._db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.where('id', id);
    qb.where('fk_table_id', this._table.id);
    await qb.update(mapped);

    return this.readByPk(id) as Promise<Record>;
  }

  async deleteByPk(
    id: string,
    trx?: Knex.Transaction,
    ctx?: RequestContext
  ): Promise<number> {
    const exists = await this.exists(id);
    if (!exists) {
      NcError.recordNotFound(id, this._table.title);
    }

    const qb = this._db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.where('id', id);
    qb.where('fk_table_id', this._table.id);

    return qb.delete();
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

    applyPagination(qb, args.limit, args.offset, this._config);

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
  // Bulk Operations
  // ==========================================================================

  async bulkInsert(data: Record[], options: BulkOptions = {}): Promise<Record[]> {
    const { chunkSize = 100, cookie, trx } = options;

    const executeInserts = async (transaction?: Knex.Transaction) => {
      const results: Record[] = [];
      const chunks = this.chunk(data, chunkSize);

      for (const batch of chunks) {
        const inserted = await Promise.all(
          batch.map((item) => this.insert(item, transaction, cookie))
        );
        results.push(...inserted);
      }

      return results;
    };

    if (trx) {
      return executeInserts(trx);
    }

    return this._db.transaction((tx) => executeInserts(tx));
  }

  async bulkUpdate(data: Record[], options: BulkOptions = {}): Promise<Record[]> {
    const { cookie, trx } = options;
    const results: Record[] = [];

    for (const item of data) {
      const id = item.id || item.Id;
      if (!id) continue;

      const updated = await this.updateByPk(id as string, item, trx, cookie);
      results.push(updated);
    }

    return results;
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

    const qb = this._db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.whereIn('id', ids);
    qb.where('fk_table_id', this._table.id);

    await qb.update(mapped);

    return ids.length;
  }

  async bulkDelete(ids: string[], options: BulkOptions = {}): Promise<number> {
    const { trx } = options;

    if (ids.length === 0) return 0;

    const qb = this._db(TABLE_DATA);
    if (trx) qb.transacting(trx);
    qb.whereIn('id', ids);
    qb.where('fk_table_id', this._table.id);

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
    const { column_name, aggregation = 'count' } = args;
    const column = getColumnsWithPk(this._table).find(
      (c) => c.column_name === column_name || c.title === column_name
    );

    if (!column) return [];

    const sqlCol = this.getColumnExpression(column);
    const qb = this.getQueryBuilder();

    qb.select(this._db.raw(`${sqlCol} as "${column_name}"`));

    switch (aggregation.toLowerCase()) {
      case 'count': qb.count('* as count'); break;
      case 'sum': qb.sum(`${sqlCol} as sum`); break;
      case 'avg': qb.avg(`${sqlCol} as avg`); break;
      case 'min': qb.min(`${sqlCol} as min`); break;
      case 'max': qb.max(`${sqlCol} as max`); break;
      default: qb.count('* as count');
    }

    qb.groupBy(this._db.raw(sqlCol));
    await this.applyFiltersAndSorts(qb, args);
    applyPagination(qb, args.limit, args.offset, this._config);

    return this.executeQuery<Record[]>(qb);
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected async buildSelect(qb: Knex.QueryBuilder, fields?: string | string[]): Promise<void> {
    const columns = parseFields(fields, this._table);
    const selects = buildSelectExpressions(columns, this._table, this._alias, this._db);
    qb.select(selects);
  }

  protected async applyFilters(qb: Knex.QueryBuilder, args: ListArgs): Promise<void> {
    if (args.filterArr?.length) {
      await applyConditions(args.filterArr, qb, this._table, this._tables, this._db);
    }
    if (args.where) {
      const filters = parseWhereString(args.where, this._table);
      if (filters.length) {
        await applyConditions(filters, qb, this._table, this._tables, this._db);
      }
    }
  }

  protected async applyFiltersAndSorts(qb: Knex.QueryBuilder, args: ListArgs): Promise<void> {
    await this.applyFilters(qb, args);

    if (args.sortArr?.length) {
      await applySorts(args.sortArr, qb, this._table, this._tables, this._db, this._alias);
    }
    if (args.sort) {
      const sorts = parseSortString(args.sort, this._table);
      if (sorts.length) {
        await applySorts(sorts, qb, this._table, this._tables, this._db, this._alias);
      }
    }
  }

  protected async executeQuery<T = Record[]>(qb: Knex.QueryBuilder): Promise<T> {
    try {
      const result = await qb;
      if (Array.isArray(result)) {
        return result.map((row) => this.parseRow(row)) as T;
      }
      return result as T;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  protected parseRow(row: Record): Record {
    if (!row) return row;

    if (typeof row.data === 'string') {
      try {
        const data = JSON.parse(row.data);
        const { data: _, ...systemFields } = row;
        return { ...systemFields, ...data };
      } catch {
        return row;
      }
    }

    if (row.data && typeof row.data === 'object') {
      const { data, ...systemFields } = row;
      return { ...systemFields, ...(data as object) };
    }

    return row;
  }

  protected populatePk(data: Record): void {
    if (!data.id) {
      data.id = ulid();
    }
  }

  protected mapDataForInsert(data: Record, ctx?: RequestContext): Record {
    const { system, userData } = this.separateSystemAndUserData(data, false);
    const now = new Date().toISOString();

    return {
      id: (system.id as string) || ulid(),
      fk_table_id: this._table.id,
      created_at: (system.created_at as string) || now,
      updated_at: (system.updated_at as string) || now,
      created_by: (system.created_by as string | null) ?? ctx?.user?.id ?? null,
      updated_by: (system.updated_by as string | null) ?? ctx?.user?.id ?? null,
      data: JSON.stringify(userData),
    };
  }

  protected mapDataForUpdate(data: Record, ctx?: RequestContext): Record {
    const { userData } = this.separateSystemAndUserData(data, true);

    return {
      updated_at: new Date().toISOString(),
      updated_by: ctx?.user?.id ?? null,
      data: JSON.stringify(userData),
    };
  }

  protected separateSystemAndUserData(
    data: Record,
    isUpdate: boolean
  ): { system: Record; userData: Record } {
    const system: Record = {};
    const userData: Record = {};
    const columns = getColumnsWithPk(this._table);

    for (const [key, value] of Object.entries(data)) {
      const column = columns.find(
        (c) => c.id === key || c.title === key || c.column_name === key
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
        userData[column.column_name] = this.convertValue(column, value);
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

  protected getColumnExpression(column: Column): string {
    const { getColumnExpression } = require('../query/sqlBuilder');
    return getColumnExpression(column, this._table, this._alias);
  }

  protected chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
