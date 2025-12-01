/**
 * Full model implementation with virtual column support
 * @module models/Model
 */

import type { Knex } from 'knex';
import { LinkModel } from '../core/LinkModel';
import type { IModel } from '../core/interfaces';
import type { Column, Table, ListArgs, Record, BulkOptions, RequestContext } from '../types';
import { ModelConfig } from '../config';
import { parseFields, isVirtualColumn, getColumnsWithPk } from '../utils/columnUtils';
import { buildSelectExpressions, applyPagination } from '../query/sqlBuilder';
import { buildFormulaExpression } from '../query/formulaBuilder';
import { buildRollupSubquery } from '../query/rollupBuilder';
import { buildLinkCountSubquery } from '../query/linkBuilder';

// ============================================================================
// Model Class
// ============================================================================

/**
 * Full model implementation with CRUD, link, and virtual column support
 */
export class Model extends LinkModel implements IModel {
  constructor(params: {
    db: Knex;
    tableId: string;
    tables: Table[];
    viewId?: string;
    alias?: string;
    config?: Partial<ModelConfig>;
  }) {
    super(params);
  }

  // ==========================================================================
  // Enhanced Query Building (Virtual Column Support)
  // ==========================================================================

  protected async buildSelect(qb: Knex.QueryBuilder, fields?: string | string[]): Promise<void> {
    const columns = parseFields(fields, this._table);
    const regularColumns = columns.filter((c) => !this.isVirtualType(c.uidt));
    const virtualColumns = columns.filter((c) => this.isVirtualType(c.uidt));

    // Add regular columns
    const selects = buildSelectExpressions(regularColumns, this._table, this._alias, this._db);
    qb.select(selects);

    // Add virtual columns
    for (const column of virtualColumns) {
      await this.addVirtualColumnSelect(qb, column);
    }
  }

  private isVirtualType(uidt: string): boolean {
    return ['Formula', 'Rollup', 'Lookup', 'LinkToAnotherRecord', 'Links'].includes(uidt);
  }

  private async addVirtualColumnSelect(qb: Knex.QueryBuilder, column: Column): Promise<void> {
    const alias = column.title || column.column_name;

    switch (column.uidt) {
      case 'Formula': {
        const options = column.colOptions as { formula?: string };
        if (options?.formula) {
          const formulaExpr = await buildFormulaExpression(
            options.formula,
            this._table,
            this._tables,
            this._db
          );
          qb.select(this._db.raw(`(${formulaExpr}) as ??`, [alias]));
        }
        break;
      }

      case 'Rollup': {
        if (column.colOptions) {
          const rollupSubQuery = await buildRollupSubquery({
            column,
            table: this._table,
            tables: this._tables,
            db: this._db,
            alias: this._alias,
          });
          qb.select(this._db.raw(`(${rollupSubQuery.toQuery()}) as ??`, [alias]));
        }
        break;
      }

      case 'LinkToAnotherRecord':
      case 'Links': {
        if (column.colOptions) {
          const countSubQuery = buildLinkCountSubquery({
            modelId: this._table.id,
            column,
            tables: this._tables,
            db: this._db,
            alias: this._alias,
          });
          qb.select(this._db.raw(`(${countSubQuery.toQuery()}) as ??`, [alias]));
        }
        break;
      }

      case 'Lookup': {
        // Lookup returns NULL in list queries for simplicity
        qb.select(this._db.raw(`NULL as ??`, [alias]));
        break;
      }
    }
  }

  // ==========================================================================
  // Enhanced List Operations
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

  async readByPk(id: string, fields?: string | string[]): Promise<Record | null> {
    const qb = this.getQueryBuilder();

    await this.buildSelect(qb, fields);

    const { buildPkWhere } = require('../query/sqlBuilder');
    qb.where(buildPkWhere(this._table, id, this._alias));
    qb.limit(1);

    const result = await this.executeQuery<Record[]>(qb);
    return result.length > 0 ? result[0] : null;
  }

  // ==========================================================================
  // Enhanced Bulk Operations
  // ==========================================================================

  async bulkInsert(data: Record[], options: BulkOptions = {}): Promise<Record[]> {
    const { chunkSize = 100, cookie, trx, skipValidation = false } = options;

    const executeInserts = async (transaction: Knex.Transaction) => {
      const results: Record[] = [];
      const chunks = this.chunk(data, chunkSize);

      for (const batch of chunks) {
        const inserted = await Promise.all(
          batch.map((item) => this.insert(this.convertData(item), transaction, cookie))
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

    const executeUpdates = async (transaction?: Knex.Transaction) => {
      const results: Record[] = [];

      for (const item of data) {
        const id = item.id || item.Id;
        if (!id) continue;

        const updated = await this.updateByPk(
          id as string,
          this.convertData(item),
          transaction,
          cookie
        );
        results.push(updated);
      }

      return results;
    };

    if (trx) {
      return executeUpdates(trx);
    }

    return this._db.transaction((tx) => executeUpdates(tx));
  }

  // ==========================================================================
  // Data Conversion
  // ==========================================================================

  private convertData(data: Record): Record {
    const columns = getColumnsWithPk(this._table);
    const converted: Record = { ...data };

    for (const column of columns) {
      const key = column.column_name;
      if (key in converted) {
        converted[key] = this.convertValue(column, converted[key]);
      }
    }

    return converted;
  }
}
