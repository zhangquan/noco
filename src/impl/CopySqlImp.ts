import type { Knex } from 'knex';
import { ulid } from 'ulid';
import { JSONModelSqlImp } from './JSONModelSqlImp';
import {
  RecordType,
  TableType,
  ModelConfig,
  CookieType,
  LinkToAnotherRecordOptionType,
  RelationTypes,
} from '../interface/types';
import {
  getColumnsIncludingPk,
  getTableByIdMust,
  getChildTableIdFromMM,
  NC_BIGTABLE,
  NC_BIGTABLE_RELATIONS,
} from '../helpers/queryBuilderHelper';

/**
 * Options for copy operations
 */
export interface CopyOptions {
  /** Copy linked records as well */
  copyRelations?: boolean;
  /** Deep copy (follow all links) */
  deepCopy?: boolean;
  /** Maximum depth for deep copy */
  maxDepth?: number;
  /** Fields to exclude from copy */
  excludeFields?: string[];
  /** Custom field transformers */
  transformers?: Record<string, (value: any) => any>;
  /** Transaction to use */
  trx?: Knex.Transaction;
  /** Cookie/context */
  cookie?: CookieType;
}

/**
 * Copy result
 */
export interface CopyResult {
  /** Original record ID */
  originalId: string;
  /** New record ID */
  newId: string;
  /** The copied record */
  record: RecordType;
  /** Copied relation IDs */
  copiedRelations?: Map<string, string[]>;
}

/**
 * Data copy implementation
 * Provides functionality to copy records and their relationships
 */
export class CopySqlImp extends JSONModelSqlImp {
  constructor(params: {
    dbDriver: Knex;
    modelId: string;
    models: TableType[];
    viewId?: string;
    alias?: string;
    config?: Partial<ModelConfig>;
  }) {
    super(params);
  }

  // ========================================
  // Copy Operations
  // ========================================

  /**
   * Copy a single record
   */
  async copyRecord(id: string, options: CopyOptions = {}): Promise<CopyResult> {
    const {
      copyRelations = false,
      excludeFields = [],
      transformers = {},
      trx,
      cookie,
    } = options;

    // Read original record
    const original = await this.readByPk(id);
    if (!original) {
      throw new Error(`Record with id '${id}' not found`);
    }

    // Prepare copy data
    const copyData = this.prepareCopyData(original, excludeFields, transformers);

    // Generate new ID
    const newId = ulid();
    copyData.id = newId;

    // Insert copy
    const copied = await this.insert(copyData, trx, cookie);

    const result: CopyResult = {
      originalId: id,
      newId,
      record: copied,
    };

    // Copy relations if requested
    if (copyRelations) {
      result.copiedRelations = await this.copyRelations(id, newId, options);
    }

    return result;
  }

  /**
   * Copy multiple records
   */
  async copyRecords(
    ids: string[],
    options: CopyOptions = {}
  ): Promise<CopyResult[]> {
    const results: CopyResult[] = [];

    // Use transaction for atomicity
    const trx = options.trx || (await this._dbDriver.transaction());

    try {
      for (const id of ids) {
        const result = await this.copyRecord(id, { ...options, trx });
        results.push(result);
      }

      // Commit if we created the transaction
      if (!options.trx) {
        await trx.commit();
      }
    } catch (error) {
      // Rollback if we created the transaction
      if (!options.trx) {
        await trx.rollback();
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
    const { trx, cookie, excludeFields = [], transformers = {} } = options;

    // Get source table records
    const sourceRecords = await this._dbDriver(NC_BIGTABLE)
      .select('*')
      .where('fk_table_id', sourceTableId);

    const idMapping = new Map<string, string>();
    const newRecords: RecordType[] = [];

    // Prepare new records
    for (const record of sourceRecords) {
      const parsed = this.parseRowInternal(record);
      const copyData = this.prepareCopyData(parsed, excludeFields, transformers);

      const newId = ulid();
      idMapping.set(record.id, newId);

      newRecords.push({
        id: newId,
        fk_table_id: targetTableId,
        data: JSON.stringify(copyData),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: cookie?.user?.id || null,
        updated_by: cookie?.user?.id || null,
      });
    }

    // Insert all records
    if (newRecords.length > 0) {
      const qb = this._dbDriver(NC_BIGTABLE);
      if (trx) {
        qb.transacting(trx);
      }
      await qb.insert(newRecords);
    }

    return {
      copiedCount: newRecords.length,
      idMapping,
    };
  }

  // ========================================
  // Relation Copy Operations
  // ========================================

  /**
   * Copy all MM relations for a record
   */
  private async copyRelations(
    originalId: string,
    newId: string,
    options: CopyOptions
  ): Promise<Map<string, string[]>> {
    const { trx } = options;
    const copiedRelations = new Map<string, string[]>();

    // Find all link columns
    const columns = getColumnsIncludingPk(this._model);
    const linkColumns = columns.filter(
      (c) =>
        c.uidt === 'LinkToAnotherRecord' &&
        (c.colOptions as LinkToAnotherRecordOptionType)?.type ===
          RelationTypes.MANY_TO_MANY
    );

    for (const linkCol of linkColumns) {
      const colOptions = linkCol.colOptions as LinkToAnotherRecordOptionType;
      const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;

      if (!mmTableId) continue;

      const mmTable = getTableByIdMust(mmTableId, this._models);

      // Get original relations
      const originalRelations = await this._dbDriver(NC_BIGTABLE_RELATIONS)
        .select('fk_child_id')
        .where('fk_table_id', mmTable.id)
        .where('fk_parent_id', originalId);

      const childIds = originalRelations.map((r) => r.fk_child_id);
      copiedRelations.set(linkCol.id, childIds);

      // Create new relations
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
        const qb = this._dbDriver(NC_BIGTABLE_RELATIONS);
        if (trx) {
          qb.transacting(trx);
        }
        await qb.insert(newRelations);
      }
    }

    return copiedRelations;
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
    const { maxDepth = 3, trx, cookie } = options;
    const all = new Map<string, CopyResult>();
    const visited = new Set<string>();

    const transaction = trx || (await this._dbDriver.transaction());

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
        await transaction.commit();
      }

      return { root, all };
    } catch (error) {
      if (!trx) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  private async deepCopyRecursive(
    id: string,
    options: CopyOptions,
    visited: Set<string>,
    all: Map<string, CopyResult>,
    currentDepth: number,
    maxDepth: number
  ): Promise<CopyResult> {
    // Check if already copied
    if (visited.has(id)) {
      return all.get(id)!;
    }

    visited.add(id);

    // Copy this record
    const result = await this.copyRecord(id, {
      ...options,
      copyRelations: false, // We handle relations ourselves
    });

    all.set(id, result);

    // If we haven't reached max depth, copy related records
    if (currentDepth < maxDepth) {
      const columns = getColumnsIncludingPk(this._model);
      const linkColumns = columns.filter(
        (c) =>
          c.uidt === 'LinkToAnotherRecord' &&
          (c.colOptions as LinkToAnotherRecordOptionType)?.type ===
            RelationTypes.MANY_TO_MANY
      );

      for (const linkCol of linkColumns) {
        const relatedRecords = await this.mmList(
          { colId: linkCol.id, parentRowId: id },
          {}
        );

        for (const relatedRecord of relatedRecords) {
          if (!visited.has(relatedRecord.id)) {
            await this.deepCopyRecursive(
              relatedRecord.id,
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

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Prepare copy data by excluding fields and applying transformers
   */
  private prepareCopyData(
    original: RecordType,
    excludeFields: string[],
    transformers: Record<string, (value: any) => any>
  ): RecordType {
    const copy: RecordType = {};

    // Default excluded fields
    const defaultExcluded = new Set([
      'id',
      'created_at',
      'updated_at',
      'created_by',
      'updated_by',
      'fk_table_id',
    ]);

    for (const [key, value] of Object.entries(original)) {
      // Skip excluded fields
      if (defaultExcluded.has(key) || excludeFields.includes(key)) {
        continue;
      }

      // Apply transformer if exists
      if (transformers[key]) {
        copy[key] = transformers[key](value);
      } else {
        copy[key] = value;
      }
    }

    return copy;
  }

  private parseRowInternal(row: RecordType): RecordType {
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
}
