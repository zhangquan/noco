/**
 * Copy model implementation for record duplication
 * @module models/CopyModel
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import { Model } from './Model';
import type { Table, Record, RequestContext, LinkColumnOption } from '../types';
import { RelationTypes } from '../types';
import { ModelConfig, TABLE_DATA, TABLE_RELATIONS } from '../config';
import { getColumnsWithPk, getTableByIdOrThrow } from '../utils/columnUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for copy operations
 */
export interface CopyOptions {
  /** Copy linked records */
  copyRelations?: boolean;
  /** Deep copy (follow all links) */
  deepCopy?: boolean;
  /** Maximum depth for deep copy */
  maxDepth?: number;
  /** Fields to exclude from copy */
  excludeFields?: string[];
  /** Custom field transformers */
  transformers?: globalThis.Record<string, (value: unknown) => unknown>;
  /** Transaction */
  trx?: Knex.Transaction;
  /** Request context */
  ctx?: RequestContext;
}

/**
 * Copy operation result
 */
export interface CopyResult {
  originalId: string;
  newId: string;
  record: Record;
  copiedRelations?: Map<string, string[]>;
}

// ============================================================================
// Copy Model Class
// ============================================================================

/**
 * Model with copy/duplicate functionality
 */
export class CopyModel extends Model {
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
  // Copy Operations
  // ==========================================================================

  /**
   * Copy a single record
   */
  async copyRecord(id: string, options: CopyOptions = {}): Promise<CopyResult> {
    const { copyRelations = false, excludeFields = [], transformers = {}, trx, ctx } = options;

    const original = await this.readByPk(id);
    if (!original) {
      throw new Error(`Record '${id}' not found`);
    }

    const copyData = this.prepareCopyData(original, excludeFields, transformers);
    const newId = ulid();
    copyData.id = newId;

    const copied = await this.insert(copyData, trx, ctx);

    const result: CopyResult = {
      originalId: id,
      newId,
      record: copied,
    };

    if (copyRelations) {
      result.copiedRelations = await this.copyRelations(id, newId, options);
    }

    return result;
  }

  /**
   * Copy multiple records
   */
  async copyRecords(ids: string[], options: CopyOptions = {}): Promise<CopyResult[]> {
    const results: CopyResult[] = [];

    const trx = options.trx || (await this._db.transaction());

    try {
      for (const id of ids) {
        const result = await this.copyRecord(id, { ...options, trx });
        results.push(result);
      }

      if (!options.trx) {
        await (trx as Knex.Transaction).commit();
      }
    } catch (error) {
      if (!options.trx) {
        await (trx as Knex.Transaction).rollback();
      }
      throw error;
    }

    return results;
  }

  /**
   * Copy an entire table's data
   */
  async copyTable(
    sourceTableId: string,
    targetTableId: string,
    options: CopyOptions = {}
  ): Promise<{
    copiedCount: number;
    idMapping: Map<string, string>;
  }> {
    const { trx, ctx, excludeFields = [], transformers = {} } = options;

    const sourceRecords = await this._db(TABLE_DATA)
      .select('*')
      .where('fk_table_id', sourceTableId);

    const idMapping = new Map<string, string>();
    const newRecords: Record[] = [];

    for (const record of sourceRecords) {
      const parsed = this.parseRow(record);
      const copyData = this.prepareCopyData(parsed, excludeFields, transformers);

      const newId = ulid();
      idMapping.set(record.id, newId);

      newRecords.push({
        id: newId,
        fk_table_id: targetTableId,
        data: JSON.stringify(copyData),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: ctx?.user?.id ?? null,
        updated_by: ctx?.user?.id ?? null,
      });
    }

    if (newRecords.length > 0) {
      const qb = this._db(TABLE_DATA);
      if (trx) qb.transacting(trx);
      await qb.insert(newRecords);
    }

    return {
      copiedCount: newRecords.length,
      idMapping,
    };
  }

  /**
   * Deep copy - copy record and all linked records recursively
   */
  async deepCopy(
    id: string,
    options: CopyOptions = {}
  ): Promise<{
    root: CopyResult;
    all: Map<string, CopyResult>;
  }> {
    const { maxDepth = 3, trx, ctx } = options;
    const all = new Map<string, CopyResult>();
    const visited = new Set<string>();

    const transaction = trx || (await this._db.transaction());

    try {
      const root = await this.deepCopyRecursive(
        id,
        { ...options, trx: transaction },
        visited,
        all,
        0,
        maxDepth
      );

      if (!trx) {
        await (transaction as Knex.Transaction).commit();
      }

      return { root, all };
    } catch (error) {
      if (!trx) {
        await (transaction as Knex.Transaction).rollback();
      }
      throw error;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async copyRelations(
    originalId: string,
    newId: string,
    options: CopyOptions
  ): Promise<Map<string, string[]>> {
    const { trx } = options;
    const copiedRelations = new Map<string, string[]>();

    const columns = getColumnsWithPk(this._table);
    const linkColumns = columns.filter((c) => {
      const opts = c.colOptions as LinkColumnOption;
      return c.uidt === 'LinkToAnotherRecord' && opts?.type === RelationTypes.MANY_TO_MANY;
    });

    for (const linkCol of linkColumns) {
      const options = linkCol.colOptions as LinkColumnOption;
      const mmTableId = options.fk_mm_model_id || options.mm_model_id;

      if (!mmTableId) continue;

      const mmTable = getTableByIdOrThrow(mmTableId, this._tables);

      const originalRelations = await this._db(TABLE_RELATIONS)
        .select('fk_child_id')
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', originalId);

      const childIds = originalRelations.map((r) => r.fk_child_id);
      copiedRelations.set(linkCol.id, childIds);

      const now = new Date().toISOString();
      const newRelations = childIds.map((childId) => ({
        id: ulid(),
        fk_table_id: mmTable.id,
        fk_parent_id: newId,
        fk_child_id: childId,
        created_at: now,
        updated_at: now,
      }));

      if (newRelations.length > 0) {
        const qb = this._db(TABLE_RELATIONS);
        if (trx) qb.transacting(trx);
        await qb.insert(newRelations);
      }
    }

    return copiedRelations;
  }

  private async deepCopyRecursive(
    id: string,
    options: CopyOptions,
    visited: Set<string>,
    all: Map<string, CopyResult>,
    currentDepth: number,
    maxDepth: number
  ): Promise<CopyResult> {
    if (visited.has(id)) {
      return all.get(id)!;
    }

    visited.add(id);

    const result = await this.copyRecord(id, {
      ...options,
      copyRelations: false,
    });

    all.set(id, result);

    if (currentDepth < maxDepth) {
      const columns = getColumnsWithPk(this._table);
      const linkColumns = columns.filter((c) => {
        const opts = c.colOptions as LinkColumnOption;
        return c.uidt === 'LinkToAnotherRecord' && opts?.type === RelationTypes.MANY_TO_MANY;
      });

      for (const linkCol of linkColumns) {
        const relatedRecords = await this.mmList(
          { colId: linkCol.id, parentRowId: id },
          {}
        );

        for (const relatedRecord of relatedRecords) {
          if (!visited.has(relatedRecord.id as string)) {
            await this.deepCopyRecursive(
              relatedRecord.id as string,
              options,
              visited,
              all,
              currentDepth + 1,
              maxDepth
            );
          }
        }
      }
    }

    return result;
  }

  private prepareCopyData(
    original: Record,
    excludeFields: string[],
    transformers: globalThis.Record<string, (value: unknown) => unknown>
  ): Record {
    const copy: Record = {};

    const defaultExcluded = new Set([
      'id',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by',
      'fk_table_id',
    ]);

    for (const [key, value] of Object.entries(original)) {
      if (defaultExcluded.has(key) || excludeFields.includes(key)) {
        continue;
      }

      if (transformers[key]) {
        copy[key] = transformers[key](value);
      } else {
        copy[key] = value;
      }
    }

    return copy;
  }
}
