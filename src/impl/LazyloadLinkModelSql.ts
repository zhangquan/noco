import type { Knex } from 'knex';
import { JSONModelSqlImp } from './JSONModelSqlImp';
import {
  ListArgs,
  RecordType,
  TableType,
  ModelConfig,
  LinkToAnotherRecordOptionType,
  RelationTypes,
} from '../interface/types';
import {
  getColumnsIncludingPk,
  getTableByIdMust,
  getChildTableIdFromMM,
} from '../helpers/queryBuilderHelper';

/**
 * Lazy loading link model implementation
 * Loads related data on demand rather than upfront
 */
export class LazyloadLinkModelSql extends JSONModelSqlImp {
  // Cache for loaded relations
  private _relationCache: Map<string, Map<string, RecordType[]>> = new Map();

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
  // Lazy Loading Methods
  // ========================================

  /**
   * Load related records for a single record lazily
   */
  async loadRelated(
    record: RecordType,
    colId: string,
    args: ListArgs = {}
  ): Promise<RecordType[]> {
    const recordId = record.id;
    if (!recordId) {
      return [];
    }

    // Check cache
    const cacheKey = `${colId}:${recordId}`;
    if (this._relationCache.has(colId)) {
      const colCache = this._relationCache.get(colId)!;
      if (colCache.has(recordId)) {
        return colCache.get(recordId)!;
      }
    }

    // Load from database
    const relatedRecords = await this.mmList({ colId, parentRowId: recordId }, args);

    // Cache result
    if (!this._relationCache.has(colId)) {
      this._relationCache.set(colId, new Map());
    }
    this._relationCache.get(colId)!.set(recordId, relatedRecords);

    return relatedRecords;
  }

  /**
   * Batch load related records for multiple records
   * More efficient than loading one by one
   */
  async batchLoadRelated(
    records: RecordType[],
    colId: string,
    args: ListArgs = {}
  ): Promise<Map<string, RecordType[]>> {
    const result = new Map<string, RecordType[]>();

    if (records.length === 0) {
      return result;
    }

    // Get relation column
    const relColumn = getColumnsIncludingPk(this._model).find(
      (c) => c.id === colId
    );
    if (!relColumn) {
      return result;
    }

    const colOptions = relColumn.colOptions as LinkToAnotherRecordOptionType;
    if (!colOptions || colOptions.type !== RelationTypes.MANY_TO_MANY) {
      return result;
    }

    // Get MM and child tables
    const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
    if (!mmTableId) {
      return result;
    }

    const mmTable = getTableByIdMust(mmTableId, this._models);
    const childTableId = getChildTableIdFromMM(this._model.id, mmTable);

    if (!childTableId) {
      return result;
    }

    const childTable = getTableByIdMust(childTableId, this._models);

    // Get all parent IDs
    const parentIds = records.map((r) => r.id).filter(Boolean) as string[];

    // Query all relations at once
    const allRelations = await this._dbDriver('nc_bigtable_relations')
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
    const childRecords = await this._dbDriver('nc_bigtable')
      .select('*')
      .where('fk_table_id', childTable.id)
      .whereIn('id', Array.from(allChildIds));

    // Create lookup map
    const childById = new Map<string, RecordType>();
    for (const child of childRecords) {
      childById.set(child.id, this.parseRow(child));
    }

    // Build result
    for (const parentId of parentIds) {
      const childIds = relationsByParent.get(parentId) || [];
      const children = childIds
        .map((id) => childById.get(id))
        .filter(Boolean) as RecordType[];
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
   * Clear relation cache
   */
  clearCache(colId?: string): void {
    if (colId) {
      this._relationCache.delete(colId);
    } else {
      this._relationCache.clear();
    }
  }

  // ========================================
  // List with Lazy Loading Support
  // ========================================

  /**
   * List records and optionally preload specific relations
   */
  async listWithRelations(
    args: ListArgs & { preloadRelations?: string[] }
  ): Promise<{
    records: RecordType[];
    relations: Map<string, Map<string, RecordType[]>>;
  }> {
    const { preloadRelations, ...listArgs } = args;

    // Get base records
    const records = await this.list(listArgs);

    // Preload specified relations
    const relations = new Map<string, Map<string, RecordType[]>>();

    if (preloadRelations && preloadRelations.length > 0 && records.length > 0) {
      for (const colId of preloadRelations) {
        const relMap = await this.batchLoadRelated(records, colId);
        relations.set(colId, relMap);
      }
    }

    return { records, relations };
  }

  /**
   * Read by PK with lazy loading support
   */
  async readByPkWithRelations(
    id: string,
    options?: {
      fields?: string | string[];
      loadRelations?: string[];
    }
  ): Promise<{
    record: RecordType | null;
    relations: Map<string, RecordType[]>;
  }> {
    const record = await this.readByPk(id, options?.fields);
    const relations = new Map<string, RecordType[]>();

    if (record && options?.loadRelations) {
      for (const colId of options.loadRelations) {
        const related = await this.loadRelated(record, colId);
        relations.set(colId, related);
      }
    }

    return { record, relations };
  }

  // ========================================
  // Row Parsing Override
  // ========================================

  protected parseRow(row: RecordType): RecordType {
    const parsed = super['parseRow'](row);

    // Initialize lazy loading proxies for relation columns
    // This could be enhanced to use JavaScript Proxy for true lazy loading
    return parsed;
  }
}
