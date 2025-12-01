import type { Knex } from 'knex';
import _ from 'lodash';
import { ulid } from 'ulid';
import type { BaseModelSql } from '../interface/BaseModelSql';
import { NcError } from '../interface/NcError';
import {
  ColumnType,
  CookieType,
  FilterType,
  GroupByArgs,
  ListArgs,
  ModelConfig,
  RecordType,
  SortType,
  TableType,
  UITypes,
  DEFAULT_MODEL_CONFIG,
  BulkOperationOptions,
} from '../interface/types';
import {
  getColumnsIncludingPk,
  getColumnById,
  getPrimaryKeyMust,
  getSqlTableName,
  getSqlColumnName,
  getQueryBuilder,
  getInsertQueryBuilder,
  buildColumnSelects,
  parseFields,
  applyPagination,
  wherePk,
  isSystemColumn,
  isVirtualColumn,
  NC_BIGTABLE,
} from '../helpers/queryBuilderHelper';
import { sanitize } from '../helpers/sanitize';
import { conditionV2, parseWhereString } from '../helpers/condition';
import { sortV2, parseSortString } from '../helpers/sortBuilder';

/**
 * Abstract base class implementing BaseModelSql interface
 * Provides core CRUD functionality for JSON-based storage
 */
export abstract class AbstractBaseModelSql implements BaseModelSql {
  // ========================================
  // Properties
  // ========================================

  protected _dbDriver: Knex;
  protected _modelId: string;
  protected _viewId?: string;
  protected _models: TableType[];
  protected _model: TableType;
  protected _alias?: string;
  protected _config: ModelConfig;

  // Column cache
  protected _columnCache: Map<string, ColumnType> = new Map();

  // ========================================
  // Constructor
  // ========================================

  constructor(params: {
    dbDriver: Knex;
    modelId: string;
    models: TableType[];
    viewId?: string;
    alias?: string;
    config?: Partial<ModelConfig>;
  }) {
    this._dbDriver = params.dbDriver;
    this._modelId = params.modelId;
    this._viewId = params.viewId;
    this._models = params.models;
    this._alias = params.alias;
    this._config = { ...DEFAULT_MODEL_CONFIG, ...params.config };

    // Find the current model
    const model = params.models.find((m) => m.id === params.modelId);
    if (!model) {
      NcError.tableNotFound(params.modelId);
    }
    this._model = model!;
  }

  // ========================================
  // Getters (Interface Properties)
  // ========================================

  get dbDriver(): Knex {
    return this._dbDriver;
  }

  get modelId(): string {
    return this._modelId;
  }

  get viewId(): string | undefined {
    return this._viewId;
  }

  get models(): TableType[] {
    return this._models;
  }

  get model(): TableType {
    return this._model;
  }

  get alias(): string | undefined {
    return this._alias;
  }

  get config(): ModelConfig {
    return this._config;
  }

  // ========================================
  // Query Builder Methods
  // ========================================

  getQueryBuilder(): Knex.QueryBuilder {
    return getQueryBuilder(this._dbDriver, this._model, this._alias);
  }

  getInsertQueryBuilder(): Knex.QueryBuilder {
    return getInsertQueryBuilder(this._dbDriver, this._model);
  }

  getSqlTableName(useAlias = false): string {
    return getSqlTableName(this._model, useAlias ? this._alias : undefined);
  }

  getSqlColumnName(column: ColumnType, model?: TableType): string {
    return getSqlColumnName(column, model || this._model, this._alias);
  }

  async buildSelectQuery(params: {
    qb: Knex.QueryBuilder;
    columns?: string | string[];
  }): Promise<Knex.QueryBuilder> {
    const { qb, columns } = params;
    const columnsToSelect = parseFields(columns, this._model);

    const selects = buildColumnSelects(
      columnsToSelect,
      this._model,
      this._alias,
      this._dbDriver
    );

    qb.select(selects);
    return qb;
  }

  async applySortAndFilter(
    qb: Knex.QueryBuilder,
    args: ListArgs
  ): Promise<Knex.QueryBuilder> {
    // Apply filters
    if (args.filterArr && args.filterArr.length > 0) {
      await conditionV2(args.filterArr, qb, this._model, this._models, this._dbDriver);
    }

    // Apply where string (legacy format)
    if (args.where) {
      const filters = parseWhereString(args.where, this._model);
      if (filters.length > 0) {
        await conditionV2(filters, qb, this._model, this._models, this._dbDriver);
      }
    }

    // Apply sorts
    if (args.sortArr && args.sortArr.length > 0) {
      await sortV2(args.sortArr, qb, this._model, this._models, this._dbDriver, this._alias);
    }

    // Apply sort string (legacy format)
    if (args.sort) {
      const sorts = parseSortString(args.sort, this._model);
      if (sorts.length > 0) {
        await sortV2(sorts, qb, this._model, this._models, this._dbDriver, this._alias);
      }
    }

    return qb;
  }

  async extractRawQueryAndExec<T = RecordType[]>(
    qb: Knex.QueryBuilder,
    driver?: Knex
  ): Promise<T> {
    const db = driver || this._dbDriver;
    try {
      const result = await qb;

      // Parse JSONB data fields
      if (Array.isArray(result)) {
        return result.map((row) => this.parseRow(row)) as T;
      }

      return result as T;
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  // ========================================
  // Data Transformation Methods
  // ========================================

  /**
   * Parse a row from database, handling JSONB data
   */
  protected parseRow(row: RecordType): RecordType {
    if (!row) return row;

    // If row has 'data' field as string, parse it
    if (typeof row.data === 'string') {
      try {
        const data = JSON.parse(row.data);
        const { data: _, ...systemFields } = row;
        return { ...systemFields, ...data };
      } catch {
        return row;
      }
    }

    // If row has 'data' field as object, merge it
    if (row.data && typeof row.data === 'object') {
      const { data, ...systemFields } = row;
      return { ...systemFields, ...data };
    }

    return row;
  }

  /**
   * Map field aliases to column names and separate system/user fields
   */
  mapAliasToColumn(
    data: RecordType,
    isUpdate = false
  ): { system: RecordType; data: RecordType } {
    const system: RecordType = {};
    const userData: RecordType = {};
    const columns = getColumnsIncludingPk(this._model);

    for (const [key, value] of Object.entries(data)) {
      // Find matching column
      const column = columns.find(
        (c) => c.id === key || c.title === key || c.column_name === key
      );

      if (!column) {
        // Unknown field, add to user data
        userData[key] = value;
        continue;
      }

      // Skip virtual columns
      if (isVirtualColumn(column)) {
        continue;
      }

      // System columns go to system object
      if (isSystemColumn(column)) {
        if (column.uidt === UITypes.ID) {
          system.id = value;
        } else if (column.uidt === UITypes.CreatedTime && !isUpdate) {
          // Set created_at only on insert
          system.created_at = value;
        } else if (column.uidt === UITypes.LastModifiedTime) {
          system.updated_at = value;
        } else if (column.uidt === UITypes.CreatedBy && !isUpdate) {
          system.created_by = value;
        } else if (column.uidt === UITypes.LastModifiedBy) {
          system.updated_by = value;
        }
      } else {
        // User columns go to data object
        userData[column.column_name] = this.convertValueForColumn(column, value);
      }
    }

    return { system, data: userData };
  }

  /**
   * Convert value based on column type
   */
  protected convertValueForColumn(column: ColumnType, value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

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
        if (Array.isArray(value)) {
          return value;
        }
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

  /**
   * Populate primary key if not provided
   */
  protected populatePk(data: RecordType): void {
    const pk = getPrimaryKeyMust(this._model);
    const pkField = pk.column_name || pk.title || 'id';

    if (!data[pkField] && !data.id) {
      data.id = ulid();
    }
  }

  /**
   * Add bigtable-specific fields for insert
   */
  protected addBigtableDataForInsert(
    mapped: { system: RecordType; data: RecordType },
    cookie?: CookieType
  ): RecordType {
    const now = new Date().toISOString();

    const insertObj: RecordType = {
      id: mapped.system.id || ulid(),
      fk_table_id: this._model.id,
      created_at: mapped.system.created_at || now,
      updated_at: mapped.system.updated_at || now,
      created_by: mapped.system.created_by || cookie?.user?.id || null,
      updated_by: mapped.system.updated_by || cookie?.user?.id || null,
      data: JSON.stringify(mapped.data),
    };

    return insertObj;
  }

  /**
   * Add bigtable-specific fields for update
   */
  protected addBigtableDataForUpdate(
    mapped: { system: RecordType; data: RecordType },
    cookie?: CookieType
  ): RecordType {
    const now = new Date().toISOString();

    const updateObj: RecordType = {
      updated_at: now,
      updated_by: cookie?.user?.id || null,
      data: JSON.stringify(mapped.data),
    };

    return updateObj;
  }

  /**
   * Build WHERE clause for primary key
   */
  protected _wherePk(id: string): Record<string, string> {
    return wherePk(this._model, id, this._alias);
  }

  // ========================================
  // Validation
  // ========================================

  async validate(columns: ColumnType[]): Promise<boolean> {
    // Basic validation - can be extended
    for (const column of columns) {
      if (column.rqd) {
        // Required field validation would happen here
      }
    }
    return true;
  }

  // ========================================
  // CRUD Operations
  // ========================================

  async readByPk(id: string, fields?: string | string[]): Promise<RecordType | null> {
    const qb = this.getQueryBuilder();
    await this.buildSelectQuery({ qb, columns: fields });
    qb.where(this._wherePk(id));
    qb.limit(1);

    const result = await this.extractRawQueryAndExec<RecordType[]>(qb);
    return result.length > 0 ? result[0] : null;
  }

  async exist(id: string): Promise<boolean> {
    const qb = this.getQueryBuilder();
    qb.select(this._dbDriver.raw('1'));
    qb.where(this._wherePk(id));
    qb.limit(1);

    const result = await qb;
    return result.length > 0;
  }

  async findOne(args: ListArgs): Promise<RecordType | null> {
    const results = await this.list({ ...args, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  async insert(
    data: RecordType,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<RecordType> {
    // Sanitize input
    const sanitizedData = sanitize(data) as RecordType;

    // Populate primary key
    this.populatePk(sanitizedData);

    // Map to columns and separate system/user fields
    const mapped = this.mapAliasToColumn(sanitizedData, false);

    // Build insert object
    const insertObj = this.addBigtableDataForInsert(mapped, cookie);

    // Execute insert
    const qb = this.getInsertQueryBuilder();
    if (trx) {
      qb.transacting(trx);
    }

    await qb.insert(insertObj);

    // Return the inserted record
    return this.readByPk(insertObj.id) as Promise<RecordType>;
  }

  async updateByPk(
    id: string,
    data: RecordType,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<RecordType> {
    // Check if record exists
    const existing = await this.readByPk(id);
    if (!existing) {
      NcError.recordNotFound(id, this._model.title);
    }

    // Sanitize input
    const sanitizedData = sanitize(data) as RecordType;

    // Merge with existing data (for JSONB fields)
    const mergedData = { ...existing, ...sanitizedData };

    // Map to columns
    const mapped = this.mapAliasToColumn(mergedData, true);

    // Build update object
    const updateObj = this.addBigtableDataForUpdate(mapped, cookie);

    // Execute update
    const qb = this._dbDriver(NC_BIGTABLE);
    if (trx) {
      qb.transacting(trx);
    }
    qb.where('id', id);
    qb.where('fk_table_id', this._model.id);
    await qb.update(updateObj);

    // Return updated record
    return this.readByPk(id) as Promise<RecordType>;
  }

  async delByPk(
    id: string,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<number> {
    // Check if record exists
    const exists = await this.exist(id);
    if (!exists) {
      NcError.recordNotFound(id, this._model.title);
    }

    const qb = this._dbDriver(NC_BIGTABLE);
    if (trx) {
      qb.transacting(trx);
    }
    qb.where('id', id);
    qb.where('fk_table_id', this._model.id);

    return await qb.delete();
  }

  // ========================================
  // List Operations
  // ========================================

  async list(args: ListArgs = {}, ignoreFilterSort = false): Promise<RecordType[]> {
    const qb = this.getQueryBuilder();

    // Build SELECT
    await this.buildSelectQuery({ qb, columns: args.fields });

    // Apply filters and sorts
    if (!ignoreFilterSort) {
      await this.applySortAndFilter(qb, args);
    }

    // Apply pagination
    applyPagination(qb, args.limit, args.offset, this._config);

    // Execute and return
    return this.extractRawQueryAndExec<RecordType[]>(qb);
  }

  async count(args: ListArgs = {}, ignoreFilterSort = false): Promise<number> {
    const qb = this.getQueryBuilder();
    qb.count('* as count');

    // Apply filters
    if (!ignoreFilterSort) {
      if (args.filterArr && args.filterArr.length > 0) {
        await conditionV2(args.filterArr, qb, this._model, this._models, this._dbDriver);
      }
      if (args.where) {
        const filters = parseWhereString(args.where, this._model);
        if (filters.length > 0) {
          await conditionV2(filters, qb, this._model, this._models, this._dbDriver);
        }
      }
    }

    const result = await qb;
    return parseInt(result[0]?.count || '0', 10);
  }

  // ========================================
  // Bulk Operations
  // ========================================

  async bulkInsert(
    datas: RecordType[],
    options: BulkOperationOptions = {}
  ): Promise<RecordType[]> {
    const { chunkSize = 100, cookie, trx } = options;
    const chunks = _.chunk(datas, chunkSize);
    const insertedIds: string[] = [];

    for (const chunk of chunks) {
      const insertObjs = chunk.map((data) => {
        const sanitizedData = sanitize(data) as RecordType;
        this.populatePk(sanitizedData);
        const mapped = this.mapAliasToColumn(sanitizedData, false);
        const insertObj = this.addBigtableDataForInsert(mapped, cookie);
        insertedIds.push(insertObj.id);
        return insertObj;
      });

      const qb = this.getInsertQueryBuilder();
      if (trx) {
        qb.transacting(trx);
      }
      await qb.insert(insertObjs);
    }

    // Return all inserted records
    const results: RecordType[] = [];
    for (const id of insertedIds) {
      const record = await this.readByPk(id);
      if (record) {
        results.push(record);
      }
    }

    return results;
  }

  async bulkUpdate(
    datas: RecordType[],
    options: BulkOperationOptions = {}
  ): Promise<RecordType[]> {
    const { cookie, trx } = options;
    const results: RecordType[] = [];
    const pk = getPrimaryKeyMust(this._model);
    const pkField = pk.column_name || pk.title || 'id';

    for (const data of datas) {
      const id = data[pkField] || data.id;
      if (!id) {
        continue;
      }

      const result = await this.updateByPk(id, data, trx, cookie);
      results.push(result);
    }

    return results;
  }

  async bulkUpdateAll(
    args: ListArgs,
    data: RecordType,
    options: BulkOperationOptions = {}
  ): Promise<number> {
    const { cookie, trx } = options;

    // Get all matching record IDs
    const records = await this.list({ ...args, fields: ['id'] }, false);
    const ids = records.map((r) => r.id);

    if (ids.length === 0) {
      return 0;
    }

    // Sanitize update data
    const sanitizedData = sanitize(data) as RecordType;
    const mapped = this.mapAliasToColumn(sanitizedData, true);
    const updateObj = this.addBigtableDataForUpdate(mapped, cookie);

    // Execute bulk update
    const qb = this._dbDriver(NC_BIGTABLE);
    if (trx) {
      qb.transacting(trx);
    }
    qb.whereIn('id', ids);
    qb.where('fk_table_id', this._model.id);

    await qb.update(updateObj);

    return ids.length;
  }

  async bulkDelete(
    ids: string[],
    options: BulkOperationOptions = {}
  ): Promise<number> {
    const { trx } = options;

    if (ids.length === 0) {
      return 0;
    }

    const qb = this._dbDriver(NC_BIGTABLE);
    if (trx) {
      qb.transacting(trx);
    }
    qb.whereIn('id', ids);
    qb.where('fk_table_id', this._model.id);

    return await qb.delete();
  }

  async bulkDeleteAll(
    args: ListArgs = {},
    options: BulkOperationOptions = {}
  ): Promise<number> {
    // Get all matching record IDs
    const records = await this.list({ ...args, fields: ['id'] }, false);
    const ids = records.map((r) => r.id);

    return this.bulkDelete(ids, options);
  }

  // ========================================
  // Aggregation Operations
  // ========================================

  async groupBy(args: GroupByArgs): Promise<RecordType[]> {
    const { column_name, aggregation = 'count' } = args;
    const column = getColumnsIncludingPk(this._model).find(
      (c) => c.column_name === column_name || c.title === column_name
    );

    if (!column) {
      return [];
    }

    const sqlCol = this.getSqlColumnName(column);
    const qb = this.getQueryBuilder();

    // Add group by column
    qb.select(this._dbDriver.raw(`${sqlCol} as "${column_name}"`));

    // Add aggregation
    switch (aggregation.toLowerCase()) {
      case 'count':
        qb.count('* as count');
        break;
      case 'sum':
        qb.sum(`${sqlCol} as sum`);
        break;
      case 'avg':
        qb.avg(`${sqlCol} as avg`);
        break;
      case 'min':
        qb.min(`${sqlCol} as min`);
        break;
      case 'max':
        qb.max(`${sqlCol} as max`);
        break;
      default:
        qb.count('* as count');
    }

    qb.groupBy(this._dbDriver.raw(sqlCol));

    // Apply filters
    await this.applySortAndFilter(qb, args);

    // Apply pagination
    applyPagination(qb, args.limit, args.offset, this._config);

    return this.extractRawQueryAndExec<RecordType[]>(qb);
  }

  async groupByV2(args: GroupByArgs): Promise<RecordType[]> {
    // V2 is the same as V1 for now
    return this.groupBy(args);
  }
}
