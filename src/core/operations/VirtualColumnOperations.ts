/**
 * Virtual column operations module
 * @module core/operations/VirtualColumnOperations
 */

import type { Knex } from 'knex';
import type { IModelContext } from '../ModelContext';
import type { Column, Table, Record } from '../../types';
import { UITypes } from '../../types';
import { getColumnsWithPk, isVirtualColumn } from '../../utils/columnUtils';
import { buildFormulaExpression } from '../../query/formulaBuilder';
import { buildRollupSubquery } from '../../query/rollupBuilder';
import { buildLinkCountSubquery } from '../../query/linkBuilder';

/**
 * Extended column options type for virtual columns
 */
interface VirtualColOptions {
  formula?: string;
  formula_raw?: string;
  fk_relation_column_id?: string;
  fk_rollup_column_id?: string;
  fk_lookup_column_id?: string;
  fk_related_model_id?: string;
  rollup_function?: string;
  [key: string]: unknown;
}

// ============================================================================
// Virtual Column Operations Interface
// ============================================================================

export interface IVirtualColumnOperations {
  /**
   * Build virtual column select expressions
   */
  buildVirtualSelects(qb: Knex.QueryBuilder): Promise<void>;

  /**
   * Get virtual columns from table
   */
  getVirtualColumns(): Column[];
}

// ============================================================================
// Virtual Column Operations Class
// ============================================================================

/**
 * Virtual column operations for Formula, Rollup, Lookup, Links
 */
export class VirtualColumnOperations implements IVirtualColumnOperations {
  constructor(protected readonly ctx: IModelContext) {}

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  async buildVirtualSelects(qb: Knex.QueryBuilder): Promise<void> {
    const virtualColumns = this.getVirtualColumns();

    for (const column of virtualColumns) {
      await this.buildVirtualColumnSelect(qb, column);
    }
  }

  getVirtualColumns(): Column[] {
    return getColumnsWithPk(this.ctx.table).filter(
      (c) => isVirtualColumn(c) && !this.isExcludedVirtualType(c)
    );
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected async buildVirtualColumnSelect(
    qb: Knex.QueryBuilder,
    column: Column
  ): Promise<void> {
    try {
      switch (column.uidt) {
        case UITypes.Formula:
          await this.buildFormulaSelect(qb, column);
          break;

        case UITypes.Rollup:
          await this.buildRollupSelect(qb, column);
          break;

        case UITypes.Lookup:
          await this.buildLookupSelect(qb, column);
          break;

        case UITypes.Links:
        case UITypes.LinkToAnotherRecord:
          await this.buildLinkSelect(qb, column);
          break;
      }
    } catch (error) {
      // Log error but don't fail the query
      this.ctx.config.logger.warn(`Failed to build virtual column ${column.title}:`, error);
    }
  }

  protected async buildFormulaSelect(
    qb: Knex.QueryBuilder,
    column: Column
  ): Promise<void> {
    const options = this.getColOptions(column);
    const formulaRaw = options?.formula_raw || options?.formula;
    if (!formulaRaw) return;

    const formulaSql = await buildFormulaExpression(
      formulaRaw as string,
      this.ctx.table,
      this.ctx.tables,
      this.ctx.db
    );

    if (formulaSql && formulaSql !== 'NULL') {
      qb.select(this.ctx.db.raw(`(${formulaSql}) as "${column.title}"`));
    }
  }

  protected async buildRollupSelect(
    qb: Knex.QueryBuilder,
    column: Column
  ): Promise<void> {
    const options = this.getColOptions(column);
    if (!options) return;

    const rollupQuery = await buildRollupSubquery({
      column,
      table: this.ctx.table,
      tables: this.ctx.tables,
      db: this.ctx.db,
      alias: this.ctx.alias,
    });

    if (rollupQuery) {
      const sql = typeof rollupQuery === 'string' ? rollupQuery : rollupQuery.toQuery();
      qb.select(this.ctx.db.raw(`(${sql}) as "${column.title}"`));
    }
  }

  protected async buildLookupSelect(
    qb: Knex.QueryBuilder,
    column: Column
  ): Promise<void> {
    const options = this.getColOptions(column);
    if (!options) return;

    // Lookup is similar to rollup - use the same subquery builder
    // The rollup builder handles lookups internally
    const lookupQuery = await buildRollupSubquery({
      column,
      table: this.ctx.table,
      tables: this.ctx.tables,
      db: this.ctx.db,
      alias: this.ctx.alias,
    });

    if (lookupQuery) {
      const sql = typeof lookupQuery === 'string' ? lookupQuery : lookupQuery.toQuery();
      qb.select(this.ctx.db.raw(`(${sql}) as "${column.title}"`));
    }
  }

  protected async buildLinkSelect(
    qb: Knex.QueryBuilder,
    column: Column
  ): Promise<void> {
    const linkCountQuery = buildLinkCountSubquery({
      modelId: this.ctx.table.id,
      column,
      tables: this.ctx.tables,
      db: this.ctx.db,
      alias: this.ctx.alias,
    });

    if (linkCountQuery) {
      const sql = typeof linkCountQuery === 'string' ? linkCountQuery : linkCountQuery.toQuery();
      qb.select(this.ctx.db.raw(`(${sql}) as "${column.title}"`));
    }
  }

  protected getColOptions(column: Column): VirtualColOptions | null {
    if (!column.colOptions) return null;

    return typeof column.colOptions === 'string'
      ? JSON.parse(column.colOptions)
      : (column.colOptions as VirtualColOptions);
  }

  protected isExcludedVirtualType(column: Column): boolean {
    // Exclude virtual types that don't need select expressions
    const excluded = [
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ];
    return excluded.includes(column.uidt as UITypes);
  }
}

/**
 * Create virtual column operations for a context
 */
export function createVirtualColumnOperations(
  ctx: IModelContext
): VirtualColumnOperations {
  return new VirtualColumnOperations(ctx);
}
