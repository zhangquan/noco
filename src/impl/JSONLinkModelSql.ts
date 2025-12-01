import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { LinkModelSql } from '../interface/LinkModelSql';
import { NcError } from '../interface/NcError';
import {
  CookieType,
  ListArgs,
  RecordType,
  TableType,
  LinkToAnotherRecordOptionType,
  RelationTypes,
  ModelConfig,
  DEFAULT_MODEL_CONFIG,
} from '../interface/types';
import {
  getColumnsIncludingPk,
  getColumnById,
  getTableByIdMust,
  getChildTableIdFromMM,
  getQueryBuilder,
  getInsertQueryBuilder,
  applyPagination,
  NC_BIGTABLE,
  NC_BIGTABLE_RELATIONS,
  getPrimaryKeyMust,
  wherePk,
  buildColumnSelects,
  parseFields,
} from '../helpers/queryBuilderHelper';
import { conditionV2 } from '../helpers/condition';
import { sortV2 } from '../helpers/sortBuilder';
import { sanitize } from '../helpers/sanitize';

/**
 * Independent Link Model implementation
 * Does not extend AbstractBaseModelSql - implements interfaces directly
 * Useful for scenarios where only link operations are needed
 */
export class JSONLinkModelSql implements LinkModelSql {
  protected _dbDriver: Knex;
  protected _modelId: string;
  protected _viewId?: string;
  protected _models: TableType[];
  protected _model: TableType;
  protected _alias?: string;
  protected _config: ModelConfig;

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

    const model = params.models.find((m) => m.id === params.modelId);
    if (!model) {
      NcError.tableNotFound(params.modelId);
    }
    this._model = model!;
  }

  // ========================================
  // Interface Property Getters
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

  // ========================================
  // MM List Operations
  // ========================================

  async mmList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<RecordType[]> {
    const { colId, parentRowId } = params;

    const { mmTable, childTable } = this.getMMTablesForColumn(colId);

    // Build child IDs subquery
    const childIdsSubquery = this.mmSubQueryBuild(
      this._model,
      mmTable,
      parentRowId,
      args.limit,
      args.offset
    );

    // Build main query for child records
    const qb = getQueryBuilder(this._dbDriver, childTable, 'child');
    qb.whereIn('child.id', childIdsSubquery);

    // Build SELECT
    this.buildChildSelectQuery(qb, childTable);

    // Apply filters and sorts
    if (args.filterArr && args.filterArr.length > 0) {
      await conditionV2(
        args.filterArr,
        qb,
        childTable,
        this._models,
        this._dbDriver
      );
    }

    if (args.sortArr && args.sortArr.length > 0) {
      await sortV2(
        args.sortArr,
        qb,
        childTable,
        this._models,
        this._dbDriver,
        'child'
      );
    }

    return this.extractRawQueryAndExec<RecordType[]>(qb);
  }

  async mmListCount(params: { colId: string; parentRowId: string }): Promise<number> {
    const { colId, parentRowId } = params;

    try {
      const { mmTable } = this.getMMTablesForColumn(colId);

      const countQuery = this.mmCountSubQueryBuild(
        this._model,
        mmTable,
        parentRowId
      );

      const result = await countQuery;
      return parseInt(result[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  // ========================================
  // MM Excluded List Operations
  // ========================================

  async getMmChildrenExcludedList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<RecordType[]> {
    const { colId, parentRowId } = params;

    const { mmTable, childTable } = this.getMMTablesForColumn(colId);

    // Build child IDs subquery (linked records)
    const linkedChildIdsSubquery = this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);

    // Build main query for excluded records
    const qb = getQueryBuilder(this._dbDriver, childTable, 'child');
    qb.whereNotIn('child.id', linkedChildIdsSubquery);

    // Build SELECT
    this.buildChildSelectQuery(qb, childTable);

    // Apply filters and sorts
    if (args.filterArr && args.filterArr.length > 0) {
      await conditionV2(
        args.filterArr,
        qb,
        childTable,
        this._models,
        this._dbDriver
      );
    }

    if (args.sortArr && args.sortArr.length > 0) {
      await sortV2(
        args.sortArr,
        qb,
        childTable,
        this._models,
        this._dbDriver,
        'child'
      );
    }

    // Apply pagination
    applyPagination(qb, args.limit, args.offset, this._config);

    return this.extractRawQueryAndExec<RecordType[]>(qb);
  }

  async getMmChildrenExcludedListCount(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<number> {
    const { colId, parentRowId } = params;

    try {
      const { mmTable, childTable } = this.getMMTablesForColumn(colId);

      const linkedChildIdsSubquery = this._dbDriver(NC_BIGTABLE_RELATIONS)
        .select('fk_child_id')
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', parentRowId);

      const qb = getQueryBuilder(this._dbDriver, childTable, 'child');
      qb.count('* as count');
      qb.whereNotIn('child.id', linkedChildIdsSubquery);

      if (args.filterArr && args.filterArr.length > 0) {
        await conditionV2(
          args.filterArr,
          qb,
          childTable,
          this._models,
          this._dbDriver
        );
      }

      const result = await qb;
      return parseInt(result[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  // ========================================
  // MM Relationship Operations
  // ========================================

  async hasChild(params: {
    colId: string;
    parentRowId: string;
    childRowId: string;
    cookie?: CookieType;
  }): Promise<boolean> {
    const { colId, parentRowId, childRowId } = params;

    try {
      const { mmTable } = this.getMMTablesForColumn(colId);

      const result = await this._dbDriver(NC_BIGTABLE_RELATIONS)
        .select(this._dbDriver.raw('1'))
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', parentRowId)
        .where('fk_child_id', childRowId)
        .limit(1);

      return result.length > 0;
    } catch {
      return false;
    }
  }

  async addChild(params: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<boolean> {
    const { colId, rowId, childId, cookie, trx } = params;

    // Check if already linked
    const exists = await this.hasChild({
      colId,
      parentRowId: rowId,
      childRowId: childId,
    });

    if (exists) {
      return true;
    }

    const { mmTable } = this.getMMTablesForColumn(colId);

    const now = new Date().toISOString();
    const insertObj = {
      id: ulid(),
      fk_table_id: mmTable.id,
      fk_parent_id: rowId,
      fk_child_id: childId,
      created_at: now,
      updated_at: now,
    };

    const qb = this._dbDriver(NC_BIGTABLE_RELATIONS);
    if (trx) {
      qb.transacting(trx);
    }

    await qb.insert(insertObj);
    return true;
  }

  async removeChild(params: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<boolean> {
    const { colId, rowId, childId, trx } = params;

    const { mmTable } = this.getMMTablesForColumn(colId);

    const qb = this._dbDriver(NC_BIGTABLE_RELATIONS);
    if (trx) {
      qb.transacting(trx);
    }

    const deleted = await qb
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .where('fk_child_id', childId)
      .delete();

    return deleted > 0;
  }

  // ========================================
  // MM Bulk Operations
  // ========================================

  /**
   * Add multiple children at once
   */
  async addChildren(params: {
    colId: string;
    rowId: string;
    childIds: string[];
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<number> {
    const { colId, rowId, childIds, cookie, trx } = params;

    if (childIds.length === 0) {
      return 0;
    }

    const { mmTable } = this.getMMTablesForColumn(colId);
    const now = new Date().toISOString();

    // Get existing links to avoid duplicates
    const existing = await this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .whereIn('fk_child_id', childIds);

    const existingChildIds = new Set(existing.map((r) => r.fk_child_id));
    const newChildIds = childIds.filter((id) => !existingChildIds.has(id));

    if (newChildIds.length === 0) {
      return 0;
    }

    const insertObjs = newChildIds.map((childId) => ({
      id: ulid(),
      fk_table_id: mmTable.id,
      fk_parent_id: rowId,
      fk_child_id: childId,
      created_at: now,
      updated_at: now,
    }));

    const qb = this._dbDriver(NC_BIGTABLE_RELATIONS);
    if (trx) {
      qb.transacting(trx);
    }

    await qb.insert(insertObjs);
    return newChildIds.length;
  }

  /**
   * Remove multiple children at once
   */
  async removeChildren(params: {
    colId: string;
    rowId: string;
    childIds: string[];
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<number> {
    const { colId, rowId, childIds, trx } = params;

    if (childIds.length === 0) {
      return 0;
    }

    const { mmTable } = this.getMMTablesForColumn(colId);

    const qb = this._dbDriver(NC_BIGTABLE_RELATIONS);
    if (trx) {
      qb.transacting(trx);
    }

    return await qb
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .whereIn('fk_child_id', childIds)
      .delete();
  }

  // ========================================
  // MM Query Building
  // ========================================

  mmSubQueryBuild(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId?: string,
    limit?: number,
    offset?: number
  ): Knex.QueryBuilder {
    const qb = this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id);

    if (parentRowId) {
      qb.where('fk_parent_id', parentRowId);
    }

    if (limit !== undefined) {
      qb.limit(limit);
    }

    if (offset !== undefined && offset > 0) {
      qb.offset(offset);
    }

    return qb;
  }

  mmCountSubQueryBuild(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId: string
  ): Knex.QueryBuilder {
    return this._dbDriver(NC_BIGTABLE_RELATIONS)
      .count('* as count')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);
  }

  // ========================================
  // Helper Methods
  // ========================================

  private getMMTablesForColumn(colId: string): {
    mmTable: TableType;
    childTable: TableType;
    colOptions: LinkToAnotherRecordOptionType;
  } {
    const relColumn = getColumnsIncludingPk(this._model).find(
      (c) => c.id === colId
    );
    if (!relColumn) {
      NcError.columnNotFound(colId);
    }

    const colOptions = relColumn!.colOptions as LinkToAnotherRecordOptionType;
    if (!colOptions || colOptions.type !== RelationTypes.MANY_TO_MANY) {
      NcError.badRequest('Column is not a many-to-many relation');
    }

    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      NcError.badRequest('MM table not configured');
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);
    const childTableId = getChildTableIdFromMM(this._model.id, mmTable);

    if (!childTableId) {
      NcError.badRequest('Could not determine child table');
    }

    const childTable = getTableByIdMust(childTableId, this._models);

    return { mmTable, childTable, colOptions };
  }

  private buildChildSelectQuery(qb: Knex.QueryBuilder, childTable: TableType): void {
    const columns = getColumnsIncludingPk(childTable);
    const selects = buildColumnSelects(
      columns.filter((c) => c.uidt !== 'LinkToAnotherRecord'),
      childTable,
      'child',
      this._dbDriver
    );
    qb.select(selects);
  }

  protected parseRow(row: RecordType): RecordType {
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
      return { ...systemFields, ...data };
    }

    return row;
  }

  protected async extractRawQueryAndExec<T = RecordType[]>(
    qb: Knex.QueryBuilder
  ): Promise<T> {
    const result = await qb;

    if (Array.isArray(result)) {
      return result.map((row) => this.parseRow(row)) as T;
    }

    return result as T;
  }
}
