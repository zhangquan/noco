/**
 * Copy operations module for deep record duplication
 * @module core/operations/CopyOperations
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { IModelContext, ModelContext } from '../ModelContext';
import type { Column, Table, RequestContext, Record } from '../../types';
import { UITypes, getColumnName } from '../../types';
import { TABLE_DATA, TABLE_LINKS } from '../../config';
import {
  getColumnsWithPk,
  getTableByIdOrThrow,
} from '../../utils/columnUtils';
import { parseRow } from '../../utils/rowParser';
import { getChildTableIdFromMM } from '../../query/sqlBuilder';
import type { CrudOperations } from './CrudOperations';
import type { LinkOperations } from './LinkOperations';

// ============================================================================
// Copy Operations Interface
// ============================================================================

export interface ICopyOperations {
  /**
   * Deep copy a record with all its relations
   */
  copyRecordDeep(
    id: string,
    options?: CopyOptions
  ): Promise<Record>;

  /**
   * Copy multiple records with relations
   */
  copyRecordsDeep(
    ids: string[],
    options?: CopyOptions
  ): Promise<Record[]>;

  /**
   * Copy relations from one record to another
   */
  copyRelations(
    sourceId: string,
    targetId: string,
    options?: CopyRelationOptions
  ): Promise<void>;
}

export interface CopyOptions {
  /** Request context for audit */
  ctx?: RequestContext;
  /** Transaction to use */
  trx?: Knex.Transaction;
  /** Whether to copy relations */
  copyRelations?: boolean;
  /** Whether to recursively copy child records */
  deepCopy?: boolean;
  /** Maximum depth for recursive copy */
  maxDepth?: number;
  /** Columns to exclude from copy */
  excludeColumns?: string[];
}

export interface CopyRelationOptions {
  /** Request context for audit */
  ctx?: RequestContext;
  /** Transaction to use */
  trx?: Knex.Transaction;
  /** Specific columns to copy */
  columns?: string[];
  /** Whether to copy child records (deep) or just link existing */
  deepCopy?: boolean;
}

// ============================================================================
// Copy Operations Class
// ============================================================================

/**
 * Copy operations for deep record duplication
 */
export class CopyOperations implements ICopyOperations {
  constructor(
    protected readonly ctx: IModelContext,
    protected readonly crudOps: CrudOperations,
    protected readonly linkOps: LinkOperations
  ) {}

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  async copyRecordDeep(
    id: string,
    options: CopyOptions = {}
  ): Promise<Record> {
    const {
      ctx: reqCtx,
      trx,
      copyRelations = true,
      deepCopy = false,
      maxDepth = 3,
      excludeColumns = [],
    } = options;

    const executor = async (transaction: Knex.Transaction): Promise<Record> => {
      // Read source record
      const source = await this.crudOps.readByPk(id);
      if (!source) {
        throw new Error(`Record ${id} not found`);
      }

      // Create copy with new ID
      const copy = this.prepareRecordForCopy(source, excludeColumns);
      const newRecord = await this.crudOps.insert(copy, transaction, reqCtx);

      // Copy relations if enabled
      if (copyRelations) {
        await this.copyRelationsInternal(
          id,
          newRecord.id as string,
          { ctx: reqCtx, trx: transaction, deepCopy },
          deepCopy ? 1 : 0,
          maxDepth
        );
      }

      return newRecord;
    };

    if (trx) {
      return executor(trx);
    }

    return this.ctx.db.transaction((tx) => executor(tx));
  }

  async copyRecordsDeep(
    ids: string[],
    options: CopyOptions = {}
  ): Promise<Record[]> {
    const results: Record[] = [];

    const executor = async (transaction: Knex.Transaction): Promise<Record[]> => {
      for (const id of ids) {
        const copy = await this.copyRecordDeep(id, {
          ...options,
          trx: transaction,
        });
        results.push(copy);
      }
      return results;
    };

    if (options.trx) {
      return executor(options.trx);
    }

    return this.ctx.db.transaction((tx) => executor(tx));
  }

  async copyRelations(
    sourceId: string,
    targetId: string,
    options: CopyRelationOptions = {}
  ): Promise<void> {
    const { trx } = options;

    const executor = async (transaction: Knex.Transaction): Promise<void> => {
      await this.copyRelationsInternal(
        sourceId,
        targetId,
        { ...options, trx: transaction },
        0,
        1
      );
    };

    if (trx) {
      await executor(trx);
      return;
    }

    await this.ctx.db.transaction((tx) => executor(tx));
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected async copyRelationsInternal(
    sourceId: string,
    targetId: string,
    options: CopyRelationOptions,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    const linkColumns = this.getLinkColumns();
    const columnsToProcess = options.columns
      ? linkColumns.filter((c) => options.columns!.includes(c.title) || options.columns!.includes(c.id))
      : linkColumns;

    for (const column of columnsToProcess) {
      await this.copyColumnRelations(
        column,
        sourceId,
        targetId,
        options,
        currentDepth,
        maxDepth
      );
    }
  }

  protected async copyColumnRelations(
    column: Column,
    sourceId: string,
    targetId: string,
    options: CopyRelationOptions,
    currentDepth: number,
    maxDepth: number
  ): Promise<void> {
    const { ctx: reqCtx, trx, deepCopy } = options;

    try {
      // Get source relations
      const relations = await this.ctx.db(TABLE_LINKS)
        .select('target_record_id')
        .where('link_field_id', column.id)
        .where('source_record_id', sourceId);

      if (relations.length === 0) return;

      const childIds = relations.map((r) => r.target_record_id);

      if (deepCopy && currentDepth < maxDepth) {
        // Deep copy: duplicate child records recursively
        const childTableId = getChildTableIdFromMM(column);
        const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);

        // Load child records
        const childRecords = await this.loadChildRecords(childTable, childIds);
        const newChildIds: string[] = [];

        // Create copies of child records
        for (const childRecord of childRecords) {
          const newChildId = ulid();
          const childCopy = this.prepareRecordForCopy(childRecord, []);
          childCopy.id = newChildId;

          await this.insertRecord(childTable, childCopy, trx, reqCtx);
          newChildIds.push(newChildId);
        }

        // Link new children to target
        await this.linkOps.mmLink(column, newChildIds, targetId, trx);
      } else {
        // Shallow copy: just link existing children to target
        await this.linkOps.mmLink(column, childIds, targetId, trx);
      }
    } catch (error) {
      this.ctx.config.logger.warn(`Failed to copy relations for column ${column.title}:`, error);
    }
  }

  protected getLinkColumns(): Column[] {
    return getColumnsWithPk(this.ctx.table).filter(
      (c) => c.uidt === UITypes.Links || c.uidt === UITypes.LinkToAnotherRecord
    );
  }

  protected prepareRecordForCopy(
    source: Record,
    excludeColumns: string[]
  ): Record {
    const copy: Record = {};
    const columns = getColumnsWithPk(this.ctx.table);
    const systemColumns = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'createdAt', 'updatedAt'];

    for (const [key, value] of Object.entries(source)) {
      // Skip system columns
      if (systemColumns.includes(key)) continue;

      // Skip excluded columns
      if (excludeColumns.includes(key)) continue;

      // Skip virtual columns
      const column = columns.find(
        (c) => c.id === key || c.title === key || getColumnName(c) === key
      );
      if (column && this.isVirtualColumn(column)) continue;

      copy[key] = value;
    }

    return copy;
  }

  protected isVirtualColumn(column: Column): boolean {
    const virtualTypes = [
      UITypes.Links,
      UITypes.LinkToAnotherRecord,
      UITypes.Rollup,
      UITypes.Lookup,
      UITypes.Formula,
    ];
    return virtualTypes.includes(column.uidt as UITypes);
  }

  protected async loadChildRecords(
    childTable: Table,
    childIds: string[]
  ): Promise<Record[]> {
    if (childIds.length === 0) return [];

    const qb = this.ctx.db(TABLE_DATA)
      .select('*')
      .where('table_id', childTable.id)
      .whereIn('id', childIds);

    const rows = await qb;
    return rows.map((row) => parseRow(row));
  }

  protected async insertRecord(
    table: Table,
    data: Record,
    trx?: Knex.Transaction,
    reqCtx?: RequestContext
  ): Promise<void> {
    const now = new Date().toISOString();
    const { id, ...userData } = data;

    const record = {
      id: id || ulid(),
      table_id: table.id,
      created_at: now,
      updated_at: now,
      created_by: reqCtx?.user?.id ?? null,
      updated_by: reqCtx?.user?.id ?? null,
      data: JSON.stringify(userData),
    };

    const qb = this.ctx.db(TABLE_DATA);
    if (trx) qb.transacting(trx);

    await qb.insert(record);
  }
}

/**
 * Create copy operations for a context
 */
export function createCopyOperations(
  ctx: IModelContext,
  crudOps: CrudOperations,
  linkOps: LinkOperations
): CopyOperations {
  return new CopyOperations(ctx, crudOps, linkOps);
}
