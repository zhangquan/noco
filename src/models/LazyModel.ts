/**
 * Lazy loading model implementation
 * @module models/LazyModel
 */

import type { Knex } from 'knex';
import { Model } from './Model';
import type { Table, ListArgs, Record, LinkColumnOption } from '../types';
import { ModelConfig, TABLE_DATA, TABLE_RELATIONS } from '../config';
import { RelationTypes } from '../types';
import { getColumnsWithPk, getTableByIdOrThrow } from '../utils/columnUtils';
import { getChildTableIdFromMM } from '../query/sqlBuilder';

// ============================================================================
// Lazy Model Class
// ============================================================================

/**
 * Model with lazy loading support for relations
 */
export class LazyModel extends Model {
  private _relationCache: Map<string, Map<string, Record[]>> = new Map();

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
  // Lazy Loading
  // ==========================================================================

  /**
   * Load related records for a single record
   */
  async loadRelated(
    record: Record,
    colId: string,
    args: ListArgs = {}
  ): Promise<Record[]> {
    const recordId = record.id;
    if (!recordId) return [];

    // Check cache
    if (this._relationCache.has(colId)) {
      const colCache = this._relationCache.get(colId)!;
      if (colCache.has(recordId as string)) {
        return colCache.get(recordId as string)!;
      }
    }

    // Load from database
    const related = await this.mmList({ colId, parentRowId: recordId as string }, args);

    // Cache result
    if (!this._relationCache.has(colId)) {
      this._relationCache.set(colId, new Map());
    }
    this._relationCache.get(colId)!.set(recordId as string, related);

    return related;
  }

  /**
   * Batch load related records for multiple records
   */
  async batchLoadRelated(
    records: Record[],
    colId: string,
    args: ListArgs = {}
  ): Promise<Map<string, Record[]>> {
    const result = new Map<string, Record[]>();

    if (records.length === 0) return result;

    const column = getColumnsWithPk(this._table).find((c) => c.id === colId);
    if (!column) return result;

    const options = column.colOptions as LinkColumnOption;
    if (!options || options.type !== RelationTypes.MANY_TO_MANY) return result;

    const mmTableId = options.fk_mm_model_id || options.mm_model_id;
    if (!mmTableId) return result;

    const mmTable = getTableByIdOrThrow(mmTableId, this._tables);
    const childTableId = getChildTableIdFromMM(this._table.id, mmTable);
    if (!childTableId) return result;

    const childTable = getTableByIdOrThrow(childTableId, this._tables);

    // Get all parent IDs
    const parentIds = records.map((r) => r.id).filter(Boolean) as string[];

    // Query all relations at once
    const allRelations = await this._db(TABLE_RELATIONS)
      .select('fk_parent_id', 'fk_child_id')
      .where('fk_table_id', mmTable.id)
      .whereIn('fk_parent_id', parentIds);

    // Group by parent
    const relationsByParent = new Map<string, string[]>();
    for (const rel of allRelations) {
      if (!relationsByParent.has(rel.fk_parent_id)) {
        relationsByParent.set(rel.fk_parent_id, []);
      }
      relationsByParent.get(rel.fk_parent_id)!.push(rel.fk_child_id);
    }

    // Get all unique child IDs
    const allChildIds = new Set<string>();
    for (const childIds of relationsByParent.values()) {
      childIds.forEach((id) => allChildIds.add(id));
    }

    if (allChildIds.size === 0) {
      parentIds.forEach((id) => result.set(id, []));
      return result;
    }

    // Load all children at once
    const childRecords = await this._db(TABLE_DATA)
      .select('*')
      .where('fk_table_id', childTable.id)
      .whereIn('id', Array.from(allChildIds));

    // Create lookup map
    const childById = new Map<string, Record>();
    for (const child of childRecords) {
      childById.set(child.id, this.parseRow(child));
    }

    // Build result
    for (const parentId of parentIds) {
      const childIds = relationsByParent.get(parentId) || [];
      const children = childIds
        .map((id) => childById.get(id))
        .filter(Boolean) as Record[];
      result.set(parentId, children);
    }

    // Update cache
    if (!this._relationCache.has(colId)) {
      this._relationCache.set(colId, new Map());
    }
    const colCache = this._relationCache.get(colId)!;
    for (const [parentId, children] of result) {
      colCache.set(parentId, children);
    }

    return result;
  }

  /**
   * List with preloaded relations
   */
  async listWithRelations(
    args: ListArgs & { preloadRelations?: string[] }
  ): Promise<{
    records: Record[];
    relations: Map<string, Map<string, Record[]>>;
  }> {
    const { preloadRelations, ...listArgs } = args;

    const records = await this.list(listArgs);
    const relations = new Map<string, Map<string, Record[]>>();

    if (preloadRelations?.length && records.length > 0) {
      for (const colId of preloadRelations) {
        const relMap = await this.batchLoadRelated(records, colId);
        relations.set(colId, relMap);
      }
    }

    return { records, relations };
  }

  /**
   * Read by PK with relations
   */
  async readByPkWithRelations(
    id: string,
    options?: {
      fields?: string | string[];
      loadRelations?: string[];
    }
  ): Promise<{
    record: Record | null;
    relations: Map<string, Record[]>;
  }> {
    const record = await this.readByPk(id, options?.fields);
    const relations = new Map<string, Record[]>();

    if (record && options?.loadRelations) {
      for (const colId of options.loadRelations) {
        const related = await this.loadRelated(record, colId);
        relations.set(colId, related);
      }
    }

    return { record, relations };
  }

  /**
   * Clear relation cache
   */
  clearCache(colId?: string): void {
    if (colId) {
      this._relationCache.delete(colId);
    } else {
      this._relationCache.clear();
    }
  }
}
