/**
 * Link operations module for many-to-many relationships
 * @module core/operations/LinkOperations
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { IModelContext } from '../ModelContext';
import { NcError } from '../NcError';
import type { Column, Table, ListArgs, Record } from '../../types';
import { UITypes } from '../../types';
import { TABLE_DATA, TABLE_LINKS } from '../../config';
import {
  getColumnsWithPk,
  getTableByIdOrThrow,
} from '../../utils/columnUtils';
import { parseRow } from '../../utils/rowParser';
import {
  createQueryBuilder,
  buildSelectExpressions,
  applyPagination,
  getChildTableIdFromMM,
} from '../../query/sqlBuilder';
import type { CrudOperations } from './CrudOperations';

// ============================================================================
// Link Operations Interface
// ============================================================================

export interface ILinkOperations {
  // Read
  mmList(column: Column, args?: ListArgs): Promise<Record[]>;
  mmListCount(column: Column, args?: ListArgs): Promise<number>;
  mmExcludedList(column: Column, args?: ListArgs): Promise<Record[]>;
  mmExcludedListCount(column: Column, args?: ListArgs): Promise<number>;

  // Write
  mmLink(column: Column, childIds: string[], parentId: string, trx?: Knex.Transaction): Promise<void>;
  mmUnlink(column: Column, childIds: string[], parentId: string, trx?: Knex.Transaction): Promise<void>;
}

// ============================================================================
// Link Operations Class
// ============================================================================

/**
 * Link operations for many-to-many relationships
 */
export class LinkOperations implements ILinkOperations {
  constructor(
    protected readonly ctx: IModelContext,
    protected readonly crudOps: CrudOperations
  ) {}

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  async mmList(column: Column, args: ListArgs = {}): Promise<Record[]> {
    const childTableId = getChildTableIdFromMM(column);
    const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);
    
    const alias = 'child';
    const qb = createQueryBuilder(this.ctx.db, childTable, alias);

    // Select child table columns
    const columns = getColumnsWithPk(childTable);
    const selects = buildSelectExpressions(columns, childTable, alias, this.ctx.db);
    qb.select(selects);

    // Join with links table
    qb.innerJoin(TABLE_LINKS + ' as rel', (join) => {
      join.on('rel.target_record_id', '=', `${alias}.id`);
      join.andOnVal('rel.link_field_id', column.id);
    });

    // Filter by parent
    if (args.parentId) {
      qb.where('rel.source_record_id', args.parentId);
    }

    applyPagination(qb, args.limit, args.offset, this.ctx.config);

    return this.executeQuery<Record[]>(qb);
  }

  async mmListCount(column: Column, args: ListArgs = {}): Promise<number> {
    const childTableId = getChildTableIdFromMM(column);
    const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);

    const alias = 'child';
    const qb = createQueryBuilder(this.ctx.db, childTable, alias);

    qb.count('* as count');

    qb.innerJoin(TABLE_LINKS + ' as rel', (join) => {
      join.on('rel.target_record_id', '=', `${alias}.id`);
      join.andOnVal('rel.link_field_id', column.id);
    });

    if (args.parentId) {
      qb.where('rel.source_record_id', args.parentId);
    }

    const result = await qb;
    return parseInt(result[0]?.count || '0', 10);
  }

  async mmExcludedList(column: Column, args: ListArgs = {}): Promise<Record[]> {
    const childTableId = getChildTableIdFromMM(column);
    const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);

    const alias = 'child';
    const qb = createQueryBuilder(this.ctx.db, childTable, alias);

    const columns = getColumnsWithPk(childTable);
    const selects = buildSelectExpressions(columns, childTable, alias, this.ctx.db);
    qb.select(selects);

    // Exclude already linked children
    const linkedSubquery = this.ctx.db(TABLE_LINKS)
      .select('target_record_id')
      .where('link_field_id', column.id)
      .andWhere('source_record_id', args.parentId || '');

    qb.whereNotIn(`${alias}.id`, linkedSubquery);

    applyPagination(qb, args.limit, args.offset, this.ctx.config);

    return this.executeQuery<Record[]>(qb);
  }

  async mmExcludedListCount(column: Column, args: ListArgs = {}): Promise<number> {
    const childTableId = getChildTableIdFromMM(column);
    const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);

    const alias = 'child';
    const qb = createQueryBuilder(this.ctx.db, childTable, alias);

    qb.count('* as count');

    const linkedSubquery = this.ctx.db(TABLE_LINKS)
      .select('target_record_id')
      .where('link_field_id', column.id)
      .andWhere('source_record_id', args.parentId || '');

    qb.whereNotIn(`${alias}.id`, linkedSubquery);

    const result = await qb;
    return parseInt(result[0]?.count || '0', 10);
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  async mmLink(
    column: Column,
    childIds: string[],
    parentId: string,
    trx?: Knex.Transaction
  ): Promise<void> {
    if (childIds.length === 0) return;

    // Get the symmetric column if it exists
    const symmetricColumnId = this.getSymmetricColumnId(column);

    const records = childIds.map((childId) => ({
      id: ulid(),
      source_record_id: parentId,
      target_record_id: childId,
      link_field_id: column.id,
      inverse_field_id: symmetricColumnId,
    }));

    const qb = this.ctx.db(TABLE_LINKS);
    if (trx) qb.transacting(trx);

    await qb.insert(records).onConflict().ignore();
  }

  async mmUnlink(
    column: Column,
    childIds: string[],
    parentId: string,
    trx?: Knex.Transaction
  ): Promise<void> {
    if (childIds.length === 0) return;

    const qb = this.ctx.db(TABLE_LINKS);
    if (trx) qb.transacting(trx);

    qb.where('source_record_id', parentId);
    qb.where('link_field_id', column.id);
    qb.whereIn('target_record_id', childIds);

    await qb.delete();
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected getSymmetricColumnId(column: Column): string | null {
    if (!column.colOptions) return null;

    const options = typeof column.colOptions === 'string'
      ? JSON.parse(column.colOptions)
      : column.colOptions;

    const childTableId = options?.fk_related_model_id || options?.fk_child_column_id;
    if (!childTableId) return null;

    // Find the symmetric column in child table
    const childTable = this.ctx.tables.find((t) => t.id === childTableId);
    if (!childTable) return null;

    const symmetricColumn = childTable.columns?.find((c) => {
      if (c.uidt !== UITypes.Links && c.uidt !== UITypes.LinkToAnotherRecord) {
        return false;
      }
      const opts = typeof c.colOptions === 'string'
        ? JSON.parse(c.colOptions)
        : c.colOptions;
      return opts?.fk_related_model_id === this.ctx.table.id;
    });

    return symmetricColumn?.id || null;
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
}

/**
 * Create link operations for a context
 */
export function createLinkOperations(
  ctx: IModelContext,
  crudOps: CrudOperations
): LinkOperations {
  return new LinkOperations(ctx, crudOps);
}
