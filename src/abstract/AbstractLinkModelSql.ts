import type { Knex } from 'knex';
import { ulid } from 'ulid';
import { AbstractBaseModelSql } from './AbstractBaseModelSql';
import type { LinkModelSql } from '../interface/LinkModelSql';
import { NcError } from '../interface/NcError';
import {
  ColumnType,
  CookieType,
  ListArgs,
  RecordType,
  TableType,
  LinkToAnotherRecordOptionType,
  RelationTypes,
} from '../interface/types';
import {
  getColumnsIncludingPk,
  getColumnById,
  getTableByIdMust,
  getChildTableIdFromMM,
  getQueryBuilder,
  applyPagination,
  NC_BIGTABLE_RELATIONS,
} from '../helpers/queryBuilderHelper';
import { conditionV2 } from '../helpers/condition';
import { sortV2 } from '../helpers/sortBuilder';

/**
 * Abstract class implementing LinkModelSql interface
 * Provides many-to-many relationship functionality
 */
export abstract class AbstractLinkModelSql
  extends AbstractBaseModelSql
  implements LinkModelSql
{
  // ========================================
  // MM List Operations
  // ========================================

  async mmList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<RecordType[]> {
    const { colId, parentRowId } = params;

    // Get relation column configuration
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

    // Get MM table and child table
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
    const childColumns = getColumnsIncludingPk(childTable);
    const selects = childColumns
      .filter((c) => !c.pk || c.uidt !== 'LinkToAnotherRecord')
      .map((c) => {
        if (c.system) {
          return `child.${c.column_name} as "${c.title || c.column_name}"`;
        }
        return this._dbDriver.raw(
          `child.data ->> '${c.column_name}' as ??`,
          [c.title || c.column_name]
        );
      });

    qb.select(selects);

    // Apply filters and sorts to child table
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

    // Get relation column configuration
    const relColumn = getColumnsIncludingPk(this._model).find(
      (c) => c.id === colId
    );
    if (!relColumn) {
      return 0;
    }

    const colOptions = relColumn.colOptions as LinkToAnotherRecordOptionType;
    if (!colOptions || colOptions.type !== RelationTypes.MANY_TO_MANY) {
      return 0;
    }

    // Get MM table
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      return 0;
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);

    // Build count query
    const countQuery = this.mmCountSubQueryBuild(this._model, mmTable, parentRowId);

    const result = await countQuery;
    return parseInt(result[0]?.count || '0', 10);
  }

  // ========================================
  // MM Excluded List Operations
  // ========================================

  async getMmChildrenExcludedList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<RecordType[]> {
    const { colId, parentRowId } = params;

    // Get relation column configuration
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

    // Get MM table and child table
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

    // Build child IDs subquery (linked records)
    const linkedChildIdsSubquery = this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);

    // Build main query for child records NOT in linked list
    const qb = getQueryBuilder(this._dbDriver, childTable, 'child');
    qb.whereNotIn('child.id', linkedChildIdsSubquery);

    // Build SELECT
    const childColumns = getColumnsIncludingPk(childTable);
    const selects = childColumns
      .filter((c) => !c.pk || c.uidt !== 'LinkToAnotherRecord')
      .map((c) => {
        if (c.system) {
          return `child.${c.column_name} as "${c.title || c.column_name}"`;
        }
        return this._dbDriver.raw(
          `child.data ->> '${c.column_name}' as ??`,
          [c.title || c.column_name]
        );
      });

    qb.select(selects);

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

    // Get relation column configuration
    const relColumn = getColumnsIncludingPk(this._model).find(
      (c) => c.id === colId
    );
    if (!relColumn) {
      return 0;
    }

    const colOptions = relColumn.colOptions as LinkToAnotherRecordOptionType;
    if (!colOptions || colOptions.type !== RelationTypes.MANY_TO_MANY) {
      return 0;
    }

    // Get MM table and child table
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      return 0;
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);
    const childTableId = getChildTableIdFromMM(this._model.id, mmTable);

    if (!childTableId) {
      return 0;
    }

    const childTable = getTableByIdMust(childTableId, this._models);

    // Build child IDs subquery (linked records)
    const linkedChildIdsSubquery = this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);

    // Count query
    const qb = getQueryBuilder(this._dbDriver, childTable, 'child');
    qb.count('* as count');
    qb.whereNotIn('child.id', linkedChildIdsSubquery);

    // Apply filters
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

    // Get relation column configuration
    const relColumn = getColumnsIncludingPk(this._model).find(
      (c) => c.id === colId
    );
    if (!relColumn) {
      return false;
    }

    const colOptions = relColumn.colOptions as LinkToAnotherRecordOptionType;
    if (!colOptions || colOptions.type !== RelationTypes.MANY_TO_MANY) {
      return false;
    }

    // Get MM table
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      return false;
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);

    // Check if relationship exists
    const result = await this._dbDriver(NC_BIGTABLE_RELATIONS)
      .select(this._dbDriver.raw('1'))
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId)
      .where('fk_child_id', childRowId)
      .limit(1);

    return result.length > 0;
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
      return true; // Already linked
    }

    // Get relation column configuration
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

    // Get MM table
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      NcError.badRequest('MM table not configured');
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);

    // Insert relationship
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

    // Get relation column configuration
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

    // Get MM table
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      NcError.badRequest('MM table not configured');
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);

    // Delete relationship
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
}
