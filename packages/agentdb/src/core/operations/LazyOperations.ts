/**
 * Lazy loading operations module
 * @module core/operations/LazyOperations
 */

import type { Knex } from 'knex';
import type { IModelContext, ModelContext } from '../ModelContext';
import type { Column, Table, ListArgs, Record } from '../../types';
import { UITypes } from '../../types';
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
// Lazy Operations Interface
// ============================================================================

export interface ILazyOperations {
  /**
   * List with lazy loaded relations
   */
  listWithRelations(args?: ListArgs): Promise<Record[]>;

  /**
   * Read by primary key with relations
   */
  readByPkWithRelations(id: string, fields?: string | string[]): Promise<Record | null>;

  /**
   * Load relations for records
   */
  loadRelations(records: Record[]): Promise<Record[]>;
}

// ============================================================================
// Lazy Operations Class
// ============================================================================

/**
 * Lazy loading operations for related data
 */
export class LazyOperations implements ILazyOperations {
  constructor(
    protected readonly ctx: IModelContext,
    protected readonly crudOps: CrudOperations,
    protected readonly linkOps: LinkOperations
  ) {}

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  async listWithRelations(args: ListArgs = {}): Promise<Record[]> {
    const records = await this.crudOps.list(args);
    return this.loadRelations(records);
  }

  async readByPkWithRelations(
    id: string,
    fields?: string | string[]
  ): Promise<Record | null> {
    const record = await this.crudOps.readByPk(id, fields);
    if (!record) return null;

    const [withRelations] = await this.loadRelations([record]);
    return withRelations;
  }

  async loadRelations(records: Record[]): Promise<Record[]> {
    if (records.length === 0) return records;

    const linkColumns = this.getLinkColumns();
    if (linkColumns.length === 0) return records;

    const recordIds = records.map((r) => r.id).filter(Boolean) as string[];

    // Load all relations in parallel
    const relationsByColumn = await Promise.all(
      linkColumns.map((col) => this.loadColumnRelations(col, recordIds))
    );

    // Merge relations into records
    return records.map((record) => {
      const withRelations = { ...record };

      linkColumns.forEach((col, index) => {
        const relations = relationsByColumn[index];
        const recordRelations = relations.get(record.id as string) || [];
        withRelations[col.title] = recordRelations;
      });

      return withRelations;
    });
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected getLinkColumns(): Column[] {
    return getColumnsWithPk(this.ctx.table).filter(
      (c) => c.uidt === UITypes.Links || c.uidt === UITypes.LinkToAnotherRecord
    );
  }

  protected async loadColumnRelations(
    column: Column,
    parentIds: string[]
  ): Promise<Map<string, Record[]>> {
    const result = new Map<string, Record[]>();

    try {
      const childTableId = getChildTableIdFromMM(column);
      const childTable = getTableByIdOrThrow(this.ctx.tables, childTableId!);

      // Batch query all relations for the parent IDs
      const relations = await this.ctx.db(TABLE_LINKS)
        .select('source_record_id', 'target_record_id')
        .where('link_field_id', column.id)
        .whereIn('source_record_id', parentIds);

      if (relations.length === 0) return result;

      // Get unique child IDs
      const childIds = [...new Set(relations.map((r) => r.target_record_id))];

      // Load all child records
      const childRecords = await this.loadChildRecords(childTable, childIds);
      const childMap = new Map(childRecords.map((r) => [r.id as string, r]));

      // Group by parent ID
      for (const relation of relations) {
        const parentId = relation.source_record_id;
        const childRecord = childMap.get(relation.target_record_id);

        if (childRecord) {
          if (!result.has(parentId)) {
            result.set(parentId, []);
          }
          result.get(parentId)!.push(childRecord);
        }
      }
    } catch (error) {
      this.ctx.config.logger.warn(`Failed to load relations for column ${column.title}:`, error);
    }

    return result;
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
}

/**
 * Create lazy operations for a context
 */
export function createLazyOperations(
  ctx: IModelContext,
  crudOps: CrudOperations,
  linkOps: LinkOperations
): LazyOperations {
  return new LazyOperations(ctx, crudOps, linkOps);
}
