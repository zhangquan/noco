/**
 * Link model mixin for many-to-many operations
 * @module core/LinkModel
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import { BaseModel } from './BaseModel';
import type { ILinkModel } from './interfaces';
import { NcError } from './NcError';
import type { Table, ListArgs, Record, LinkColumnOption } from '../types';
import { RelationTypes } from '../types';
import { TABLE_RELATIONS } from '../config';
import { getColumnsWithPk, getTableByIdOrThrow, getColumnById } from '../utils/columnUtils';
import { createQueryBuilder, buildSelectExpressions, applyPagination, getChildTableIdFromMM } from '../query/sqlBuilder';
import { applyConditions } from '../query/conditionBuilder';
import { applySorts } from '../query/sortBuilder';

// ============================================================================
// Link Model Class
// ============================================================================

/**
 * Link model with many-to-many operations
 */
export class LinkModel extends BaseModel implements ILinkModel {
  // ==========================================================================
  // MM List Operations
  // ==========================================================================

  async mmList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<Record[]> {
    const { colId, parentRowId } = params;
    const { mmTable, childTable } = this.getMmTables(colId);

    const childIdsSubquery = this.buildMmSubquery(
      this._table,
      mmTable,
      parentRowId,
      args.limit,
      args.offset
    );

    const qb = createQueryBuilder(this._db, childTable, 'child');
    qb.whereIn('child.id', childIdsSubquery);

    this.buildChildSelect(qb, childTable);

    if (args.filterArr?.length) {
      await applyConditions(args.filterArr, qb, childTable, this._tables, this._db);
    }

    if (args.sortArr?.length) {
      await applySorts(args.sortArr, qb, childTable, this._tables, this._db, 'child');
    }

    return this.executeQuery<Record[]>(qb);
  }

  async mmListCount(params: { colId: string; parentRowId: string }): Promise<number> {
    const { colId, parentRowId } = params;

    try {
      const { mmTable } = this.getMmTables(colId);
      const countQuery = this.buildMmCountSubquery(this._table, mmTable, parentRowId);
      const result = await countQuery;
      return parseInt(result[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // MM Excluded List
  // ==========================================================================

  async getExcludedList(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<Record[]> {
    const { colId, parentRowId } = params;
    const { mmTable, childTable } = this.getMmTables(colId);

    const linkedSubquery = this._db(TABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);

    const qb = createQueryBuilder(this._db, childTable, 'child');
    qb.whereNotIn('child.id', linkedSubquery);

    this.buildChildSelect(qb, childTable);

    if (args.filterArr?.length) {
      await applyConditions(args.filterArr, qb, childTable, this._tables, this._db);
    }

    if (args.sortArr?.length) {
      await applySorts(args.sortArr, qb, childTable, this._tables, this._db, 'child');
    }

    applyPagination(qb, args.limit, args.offset, this._config);

    return this.executeQuery<Record[]>(qb);
  }

  async getExcludedListCount(
    params: { colId: string; parentRowId: string },
    args: ListArgs = {}
  ): Promise<number> {
    const { colId, parentRowId } = params;

    try {
      const { mmTable, childTable } = this.getMmTables(colId);

      const linkedSubquery = this._db(TABLE_RELATIONS)
        .select('fk_child_id')
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', parentRowId);

      const qb = createQueryBuilder(this._db, childTable, 'child');
      qb.count('* as count');
      qb.whereNotIn('child.id', linkedSubquery);

      if (args.filterArr?.length) {
        await applyConditions(args.filterArr, qb, childTable, this._tables, this._db);
      }

      const result = await qb;
      return parseInt(result[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Relationship Operations
  // ==========================================================================

  async hasLink(params: {
    colId: string;
    parentRowId: string;
    childRowId: string;
  }): Promise<boolean> {
    const { colId, parentRowId, childRowId } = params;

    try {
      const { mmTable } = this.getMmTables(colId);

      const result = await this._db(TABLE_RELATIONS)
        .select(this._db.raw('1'))
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', parentRowId)
        .where('fk_child_id', childRowId)
        .limit(1);

      return result.length > 0;
    } catch {
      return false;
    }
  }

  async addLink(params: {
    colId: string;
    rowId: string;
    childId: string;
    trx?: Knex.Transaction;
  }): Promise<boolean> {
    const { colId, rowId, childId, trx } = params;

    const exists = await this.hasLink({
      colId,
      parentRowId: rowId,
      childRowId: childId,
    });

    if (exists) return true;

    const { mmTable } = this.getMmTables(colId);
    const now = new Date().toISOString();

    const qb = this._db(TABLE_RELATIONS);
    if (trx) qb.transacting(trx);

    await qb.insert({
      id: ulid(),
      fk_table_id: mmTable.id,
      fk_parent_id: rowId,
      fk_child_id: childId,
      created_at: now,
      updated_at: now,
    });

    return true;
  }

  async removeLink(params: {
    colId: string;
    rowId: string;
    childId: string;
    trx?: Knex.Transaction;
  }): Promise<boolean> {
    const { colId, rowId, childId, trx } = params;
    const { mmTable } = this.getMmTables(colId);

    const qb = this._db(TABLE_RELATIONS);
    if (trx) qb.transacting(trx);

    const deleted = await qb
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .where('fk_child_id', childId)
      .delete();

    return deleted > 0;
  }

  // ==========================================================================
  // Bulk Link Operations
  // ==========================================================================

  async addLinks(params: {
    colId: string;
    rowId: string;
    childIds: string[];
    trx?: Knex.Transaction;
  }): Promise<number> {
    const { colId, rowId, childIds, trx } = params;

    if (childIds.length === 0) return 0;

    const { mmTable } = this.getMmTables(colId);
    const now = new Date().toISOString();

    // Get existing links
    const existing = await this._db(TABLE_RELATIONS)
      .select('fk_child_id')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .whereIn('fk_child_id', childIds);

    const existingSet = new Set(existing.map((r) => r.fk_child_id));
    const newChildIds = childIds.filter((id) => !existingSet.has(id));

    if (newChildIds.length === 0) return 0;

    const insertData = newChildIds.map((childId) => ({
      id: ulid(),
      fk_table_id: mmTable.id,
      fk_parent_id: rowId,
      fk_child_id: childId,
      created_at: now,
      updated_at: now,
    }));

    const qb = this._db(TABLE_RELATIONS);
    if (trx) qb.transacting(trx);

    await qb.insert(insertData);
    return newChildIds.length;
  }

  async removeLinks(params: {
    colId: string;
    rowId: string;
    childIds: string[];
    trx?: Knex.Transaction;
  }): Promise<number> {
    const { colId, rowId, childIds, trx } = params;

    if (childIds.length === 0) return 0;

    const { mmTable } = this.getMmTables(colId);

    const qb = this._db(TABLE_RELATIONS);
    if (trx) qb.transacting(trx);

    return qb
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', rowId)
      .whereIn('fk_child_id', childIds)
      .delete();
  }

  // ==========================================================================
  // Query Building
  // ==========================================================================

  buildMmSubquery(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId?: string,
    limit?: number,
    offset?: number
  ): Knex.QueryBuilder {
    const qb = this._db(TABLE_RELATIONS)
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

  buildMmCountSubquery(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId: string
  ): Knex.QueryBuilder {
    return this._db(TABLE_RELATIONS)
      .count('* as count')
      .where('fk_table_id', mmTable.id)
      .where('fk_parent_id', parentRowId);
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected getMmTables(colId: string): {
    mmTable: Table;
    childTable: Table;
    options: LinkColumnOption;
  } {
    const column = getColumnsWithPk(this._table).find((c) => c.id === colId);
    if (!column) {
      NcError.columnNotFound(colId);
    }

    const options = column!.colOptions as LinkColumnOption;
    if (!options || options.type !== RelationTypes.MANY_TO_MANY) {
      NcError.badRequest('Column is not a many-to-many relation');
    }

    const mmTableId = options.fk_mm_model_id || options.mm_model_id;
    if (!mmTableId) {
      NcError.badRequest('MM table not configured');
    }

    const mmTable = getTableByIdOrThrow(mmTableId, this._tables);
    const childTableId = getChildTableIdFromMM(this._table.id, mmTable);

    if (!childTableId) {
      NcError.badRequest('Could not determine child table');
    }

    const childTable = getTableByIdOrThrow(childTableId, this._tables);

    return { mmTable, childTable, options };
  }

  protected buildChildSelect(qb: Knex.QueryBuilder, childTable: Table): void {
    const columns = getColumnsWithPk(childTable).filter(
      (c) => c.uidt !== 'LinkToAnotherRecord'
    );
    const selects = buildSelectExpressions(columns, childTable, 'child', this._db);
    qb.select(selects);
  }
}
