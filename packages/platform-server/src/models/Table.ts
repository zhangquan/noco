/**
 * Model - Core abstraction layer for table entities
 * Implements SDK TableType interface and manages table metadata and Schema
 * @module models/Model
 */

import type { Knex } from 'knex';
import { NocoCache } from '../cache/index.js';
import { getDb, generateId } from '../db/index.js';
import {
  CacheScope,
  MetaTable,
  ModelTypes,
  type TableType,
  type ColumnType,
  type ViewType,
  type SchemaData,
  isTextCol,
} from '../types/index.js';
import { Schema, type JsonPatchOperation, type SchemaPatchResult } from './Schema.js';

// ============================================================================
// Types
// ============================================================================

export interface TableOptions {
  /** Custom Knex instance (for transactions) */
  knex?: Knex;
  /** Skip cache operations */
  skipCache?: boolean;
}

export interface QueryOptions {
  condition?: Record<string, unknown>;
  conditionArr?: Array<{ key: string; value: unknown; op?: string }>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  xcCondition?: Record<string, unknown>;
}

// ============================================================================
// Model Class
// ============================================================================

/**
 * Model class - Core abstraction for table entities
 * Implements TableType interface from SDK
 * Uses database as storage interface
 *
 * @example
 * ```typescript
 * // Get a model
 * const model = await Model.get(modelId);
 *
 * // Get schema with caching
 * const schema = await model.getSchema();
 *
 * // Update schema and trigger publish state
 * await model.updateSchema({ columns: [...] });
 *
 * // Access primary key column
 * const pkCol = model.primaryKey;
 * ```
 */
export class Model implements TableType {
  // ==========================================================================
  // Basic Identification Properties
  // ==========================================================================

  /** Unique identifier */
  id: string;

  /** Display title */
  title: string;

  /** Database table name */
  table_name?: string;

  /** URL-friendly identifier */
  slug?: string;

  /** Universal unique identifier */
  uuid?: string;

  /** Model type (table or view) */
  type?: ModelTypes;

  // ==========================================================================
  // Hierarchy Properties
  // ==========================================================================

  /** Project ID (direct reference) */
  project_id?: string;

  /** Database/Base ID (direct reference) */
  base_id?: string;

  /** Group ID */
  group_id?: string;

  /** Parent model ID */
  parent_id?: string;

  /** Foreign key to project */
  fk_project_id?: string;

  /** Foreign key to database/base */
  fk_base_id?: string;

  // ==========================================================================
  // Schema Properties
  // ==========================================================================

  /** Development schema ID */
  fk_schema_id?: string;

  /** Published schema ID */
  fk_public_schema_id?: string;

  /** Cached schema object */
  private _schema?: SchemaData;

  /** Cached published schema */
  private _publicSchema?: SchemaData;

  /** Columns from schema (cached) */
  private _columns?: ColumnType[];

  /** Views from schema (cached) */
  private _views?: ViewType[];

  // ==========================================================================
  // Configuration Properties
  // ==========================================================================

  /** Is model enabled */
  enabled?: boolean;

  /** Is model deleted (soft delete) */
  deleted?: boolean;

  /** Allow data copy */
  copy_enabled?: boolean;

  /** Allow data export */
  export_enabled?: boolean;

  /** Is pinned */
  pin?: boolean;
  pinned?: boolean;

  /** Show all fields by default */
  show_all_fields?: boolean;

  /** Access password */
  password?: string;

  // ==========================================================================
  // Publish State Properties
  // ==========================================================================

  /** Is published */
  is_publish?: boolean;

  /** Needs publishing (schema changed) */
  need_publish?: boolean;

  /** Last publish timestamp */
  publish_at?: Date;

  // ==========================================================================
  // BigTable Storage Properties
  // ==========================================================================

  /** Underlying storage table name */
  bigtable_table_name?: MetaTable;

  /** Is many-to-many junction table */
  mm?: boolean;

  // ==========================================================================
  // Metadata Properties
  // ==========================================================================

  /** Display order */
  order?: number;

  /** Additional metadata */
  meta?: Record<string, unknown>;

  /** Description for AI/docs */
  description?: string;

  /** Hints for AI operations */
  hints?: string[];

  /** Created timestamp */
  created_at?: Date;

  /** Updated timestamp */
  updated_at?: Date;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor(data: Partial<TableType>) {
    this.id = data.id || '';
    this.title = data.title || '';
    this.table_name = data.table_name;
    this.slug = data.slug;
    this.uuid = data.uuid;
    this.type = data.type;

    this.project_id = data.project_id;
    this.base_id = data.base_id;
    this.group_id = data.group_id;
    this.parent_id = data.parent_id;
    this.fk_project_id = data.fk_project_id;
    this.fk_base_id = data.fk_base_id;

    this.fk_schema_id = data.fk_schema_id;
    this.fk_public_schema_id = data.fk_public_schema_id;
    this._columns = data.columns;
    this._views = data.views;

    this.enabled = data.enabled;
    this.deleted = data.deleted;
    this.copy_enabled = data.copy_enabled;
    this.export_enabled = data.export_enabled;
    this.pin = data.pin;
    this.pinned = data.pinned;
    this.show_all_fields = data.show_all_fields;
    this.password = data.password;

    this.is_publish = data.is_publish;
    this.need_publish = data.need_publish;
    this.publish_at = data.publish_at;

    this.bigtable_table_name = data.bigtable_table_name;
    this.mm = data.mm;

    this.order = data.order;
    this.meta = data.meta;
    this.description = data.description;
    this.hints = data.hints;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // ==========================================================================
  // Schema Methods
  // ==========================================================================

  /**
   * Get Schema model instance (DEV environment)
   */
  async getSchemaModel(options?: TableOptions): Promise<Schema | null> {
    return Schema.getOrCreate({
      domain: 'model',
      fk_domain_id: this.id,
      fk_project_id: this.project_id || this.fk_project_id || '',
      env: 'DEV',
    }, options);
  }

  /**
   * Get published Schema model instance (PRO environment)
   */
  async getPublicSchemaModel(options?: TableOptions): Promise<Schema | null> {
    return Schema.getByDomainAndEnv('model', this.id, 'PRO', options);
  }

  /**
   * Get schema data with caching
   */
  async getSchema(options?: TableOptions): Promise<SchemaData | null> {
    if (this._schema) {
      return this._schema;
    }

    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      return null;
    }

    // Convert Schema model data to SchemaData format
    const schemaData: SchemaData = {
      id: schemaModel.id,
      domain: schemaModel.domain,
      fk_domain_id: schemaModel.domainId,
      fk_project_id: schemaModel.projectId,
      data: schemaModel.data,
      env: schemaModel.env,
      version: schemaModel.version,
      created_at: schemaModel.createdAt,
      updated_at: schemaModel.updatedAt,
    };

    this._schema = schemaData;
    this.fk_schema_id = schemaModel.id;

    // Extract columns and views from schema data
    if (schemaData.data?.columns) {
      this._columns = schemaData.data.columns as ColumnType[];
    }
    if (schemaData.data?.views) {
      this._views = schemaData.data.views as ViewType[];
    }

    return schemaData;
  }

  /**
   * Update schema using JSON Patch operations
   * @param patches - Array of JSON Patch operations
   * @param options - Database options
   * @returns Patch result with new version
   */
  async patchSchema(
    patches: JsonPatchOperation[],
    options?: TableOptions
  ): Promise<SchemaPatchResult> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      throw new Error('Schema not found for model');
    }

    const result = await schemaModel.applyPatch(patches, options);

    // Clear cached schema
    this._schema = undefined;
    this._columns = undefined;
    this._views = undefined;

    // Mark as needing publish
    await Model.update(this.id, { need_publish: true }, options);
    this.need_publish = true;

    return result;
  }

  /**
   * Update schema data (full replace)
   */
  async updateSchema(
    data: Partial<SchemaData> | Record<string, unknown>,
    options?: TableOptions
  ): Promise<SchemaData | null> {
    const schemaModel = await this.getSchemaModel(options);
    const inputData = data as Record<string, unknown>;
    const schemaData = (inputData.data as Record<string, unknown>) || inputData;

    if (!schemaModel) {
      // Create new schema if not exists
      const newSchema = await Schema.create({
        domain: 'model',
        fk_domain_id: this.id,
        fk_project_id: this.project_id || this.fk_project_id || '',
        data: schemaData,
        env: 'DEV',
      }, options);

      // Update model with schema reference
      const db = options?.knex || getDb();
      await db(MetaTable.MODELS)
        .where('id', this.id)
        .update({ fk_schema_id: newSchema.id, updated_at: new Date() });
      this.fk_schema_id = newSchema.id;
    } else {
      // Update existing schema
      await schemaModel.updateData(schemaData, options);
    }

    // Mark as needing publish
    await Model.update(this.id, { need_publish: true }, options);
    this.need_publish = true;

    // Clear cached schema
    this._schema = undefined;
    this._columns = undefined;
    this._views = undefined;

    return this.getSchema(options);
  }

  /**
   * Publish schema (copy DEV to PRO)
   */
  async publishSchema(options?: TableOptions): Promise<Schema | null> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      throw new Error('No schema to publish');
    }

    const publishedSchema = await schemaModel.publish(options);

    // Update model with published schema reference
    const db = options?.knex || getDb();
    await db(MetaTable.MODELS)
      .where('id', this.id)
      .update({
        fk_public_schema_id: publishedSchema.id,
        is_publish: true,
        need_publish: false,
        publish_at: new Date(),
        updated_at: new Date(),
      });

    this.fk_public_schema_id = publishedSchema.id;
    this.is_publish = true;
    this.need_publish = false;
    this.publish_at = new Date();

    return publishedSchema;
  }

  /**
   * Add a column to schema using JSON Patch
   */
  async addColumn(column: ColumnType, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'add', path: '/columns/-', value: column }
    ], options);
  }

  /**
   * Update a column in schema using JSON Patch
   */
  async updateColumn(
    columnIndex: number,
    updates: Partial<ColumnType>,
    options?: TableOptions
  ): Promise<SchemaPatchResult> {
    const patches: JsonPatchOperation[] = Object.entries(updates).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/columns/${columnIndex}/${key}`,
      value,
    }));
    return this.patchSchema(patches, options);
  }

  /**
   * Remove a column from schema using JSON Patch
   */
  async removeColumn(columnIndex: number, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'remove', path: `/columns/${columnIndex}` }
    ], options);
  }

  /**
   * Add a view to schema using JSON Patch
   */
  async addView(view: ViewType, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'add', path: '/views/-', value: view }
    ], options);
  }

  // ==========================================================================
  // Primary Key / Primary Value Getters
  // ==========================================================================

  /**
   * Get the primary key column
   */
  get primaryKey(): ColumnType | undefined {
    const columns = this._columns || [];

    // First, try to find a column with pk: true
    const pkColumn = columns.find((col) => col.pk === true);
    if (pkColumn) {
      return pkColumn;
    }

    // Fallback: find column named 'id'
    return columns.find(
      (col) => col.column_name === 'id' || col.id === 'id' || col.title?.toLowerCase() === 'id'
    );
  }

  /**
   * Get all primary key columns (for composite keys)
   */
  get primaryKeys(): ColumnType[] {
    const columns = this._columns || [];
    return columns.filter((col) => col.pk === true);
  }

  /**
   * Get the primary value column (display column)
   */
  get primaryValue(): ColumnType | undefined {
    const columns = this._columns || [];

    // First, try to find a column with pv: true
    const pvColumn = columns.find((col) => col.pv === true);
    if (pvColumn) {
      return pvColumn;
    }

    // Fallback: find first text column that's not the primary key
    return columns.find((col) => !col.pk && isTextCol(col));
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): TableType {
    return {
      id: this.id,
      title: this.title,
      table_name: this.table_name,
      slug: this.slug,
      uuid: this.uuid,
      type: this.type,
      project_id: this.project_id,
      base_id: this.base_id,
      group_id: this.group_id,
      parent_id: this.parent_id,
      fk_project_id: this.fk_project_id,
      fk_base_id: this.fk_base_id,
      fk_schema_id: this.fk_schema_id,
      fk_public_schema_id: this.fk_public_schema_id,
      columns: this._columns,
      views: this._views,
      enabled: this.enabled,
      deleted: this.deleted,
      copy_enabled: this.copy_enabled,
      export_enabled: this.export_enabled,
      pin: this.pin,
      pinned: this.pinned,
      show_all_fields: this.show_all_fields,
      password: this.password,
      is_publish: this.is_publish,
      need_publish: this.need_publish,
      publish_at: this.publish_at,
      bigtable_table_name: this.bigtable_table_name,
      mm: this.mm,
      order: this.order,
      meta: this.meta,
      description: this.description,
      hints: this.hints,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Get raw data
   */
  getData(): TableType {
    return this.toJSON();
  }

  // ==========================================================================
  // Static Methods
  // ==========================================================================

  /**
   * Get a model by ID
   */
  static async get(id: string, options?: TableOptions): Promise<Model | null> {
    const data = await getById<TableType>(CacheScope.MODEL, MetaTable.MODELS, id, options);
    return data ? new Model(data) : null;
  }

  /**
   * Get a model by title within a project
   */
  static async getByTitle(
    projectId: string,
    title: string,
    options?: TableOptions
  ): Promise<Model | null> {
    const data = await getByCondition<TableType>(
      MetaTable.MODELS,
      { project_id: projectId, title, deleted: false },
      options
    );
    return data ? new Model(data) : null;
  }

  /**
   * Check if a title is available within a project
   */
  static async checkTitleAvailable(
    projectId: string,
    title: string,
    excludeId?: string,
    options?: TableOptions
  ): Promise<boolean> {
    const existing = await this.getByTitle(projectId, title, options);
    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    return false;
  }

  /**
   * Create a new model
   */
  static async insert(
    data: Partial<TableType> & { project_id: string; title: string },
    options?: TableOptions
  ): Promise<Model> {
    const db = options?.knex || getDb();
    const cache = NocoCache.getInstance();
    const now = new Date();
    const id = generateId();

    // Generate table_name from title if not provided
    const table_name =
      data.table_name ||
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    const modelData: Partial<TableType> = {
      ...data,
      id,
      table_name,
      enabled: data.enabled ?? true,
      deleted: false,
      type: data.type || ModelTypes.TABLE,
      created_at: now,
      updated_at: now,
    };

    await db(MetaTable.MODELS).insert(modelData);

    const model = await this.get(id, { ...options, skipCache: true });
    if (!model) throw new Error('Failed to create model');

    if (!options?.skipCache) {
      await cache.set(`${CacheScope.MODEL}:${id}`, model.getData());
      await cache.invalidateList(CacheScope.MODEL, data.project_id);
    }

    return model;
  }

  /**
   * Update a model
   */
  static async update(
    id: string,
    data: Partial<TableType>,
    options?: TableOptions
  ): Promise<void> {
    const model = await this.get(id, options);
    await updateRecord<TableType>(CacheScope.MODEL, MetaTable.MODELS, id, data, options);
    if (model && !options?.skipCache) {
      await invalidateListCache(CacheScope.MODEL, model.project_id || '');
    }
  }

  /**
   * Soft delete a model
   */
  static async softDelete(id: string, options?: TableOptions): Promise<void> {
    const model = await this.get(id, options);
    await updateRecord<TableType>(
      CacheScope.MODEL,
      MetaTable.MODELS,
      id,
      { deleted: true },
      options
    );
    if (model && !options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`${CacheScope.MODEL}:${id}`);
      await cache.invalidateList(CacheScope.MODEL, model.project_id || '');
    }
  }

  /**
   * Hard delete a model
   */
  static async delete(id: string, options?: TableOptions): Promise<number> {
    const model = await this.get(id, options);
    const result = await deleteRecord(CacheScope.MODEL, MetaTable.MODELS, id, options);
    if (model && !options?.skipCache) {
      await invalidateListCache(CacheScope.MODEL, model.project_id || '');
    }
    return result;
  }

  /**
   * List models for a project
   */
  static async listForProject(
    projectId: string,
    groupId?: string,
    options?: TableOptions
  ): Promise<Model[]> {
    const condition: Record<string, unknown> = { project_id: projectId, deleted: false };
    if (groupId !== undefined) {
      condition.group_id = groupId;
    }

    const data = await listRecords<TableType>(
      CacheScope.MODEL,
      MetaTable.MODELS,
      groupId ? `${projectId}:${groupId}` : projectId,
      { condition, orderBy: { order: 'asc', created_at: 'asc' } },
      options
    );

    return data.map((d) => new Model(d));
  }

}

// ============================================================================
// Helper Functions (kept for backward compatibility)
// ============================================================================

function getCache(): NocoCache {
  return NocoCache.getInstance();
}

function getKnex(options?: TableOptions): Knex {
  return options?.knex || getDb();
}

/**
 * Generate a new ID using ULID
 */
export function genId(): string {
  return generateId();
}

// ============================================================================
// CRUD Operations (Generic helpers for other models)
// ============================================================================

/**
 * Get a single record by ID
 */
export async function getById<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  options?: TableOptions
): Promise<T | null> {
  const cache = getCache();
  const db = getKnex(options);

  if (!options?.skipCache) {
    const cached = await cache.get<T>(`${cacheScope}:${id}`);
    if (cached) return cached;
  }

  const data = await db(metaTable).where('id', id).first();
  if (!data) return null;

  if (!options?.skipCache) {
    await cache.set(`${cacheScope}:${id}`, data);
  }

  return data as T;
}

/**
 * Get a single record by condition
 */
export async function getByCondition<T extends object>(
  metaTable: MetaTable,
  condition: Record<string, unknown>,
  options?: TableOptions
): Promise<T | null> {
  const db = getKnex(options);
  const data = await db(metaTable).where(condition).first();
  return (data as T) || null;
}

/**
 * List records with optional filtering
 */
export async function listRecords<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  listKey: string,
  listOptions?: QueryOptions,
  options?: TableOptions
): Promise<T[]> {
  const cache = getCache();
  const db = getKnex(options);

  if (!options?.skipCache) {
    const cached = await cache.getList<T>(cacheScope, listKey);
    if (cached) return cached;
  }

  let query = db(metaTable);

  if (listOptions?.condition) {
    query = query.where(listOptions.condition);
  }

  if (listOptions?.conditionArr) {
    for (const cond of listOptions.conditionArr) {
      const op = cond.op || '=';
      if (op === 'is') {
        if (cond.value === null) {
          query = query.whereNull(cond.key);
        } else {
          query = query.where(cond.key, cond.value as any);
        }
      } else if (op === 'is not') {
        if (cond.value === null) {
          query = query.whereNotNull(cond.key);
        } else {
          query = query.whereNot(cond.key, cond.value as any);
        }
      } else if (op === 'in' && Array.isArray(cond.value)) {
        query = query.whereIn(cond.key, cond.value as any[]);
      } else if (op === 'like') {
        query = query.where(cond.key, 'like', cond.value as string);
      } else {
        query = query.where(cond.key, op, cond.value as any);
      }
    }
  }

  if (listOptions?.xcCondition) {
    query = applyXcCondition(query, listOptions.xcCondition);
  }

  if (listOptions?.orderBy) {
    for (const [col, dir] of Object.entries(listOptions.orderBy)) {
      query = query.orderBy(col, dir);
    }
  }

  if (listOptions?.limit) query = query.limit(listOptions.limit);
  if (listOptions?.offset) query = query.offset(listOptions.offset);

  const dataList = await query;

  if (!options?.skipCache) {
    await cache.setList(cacheScope, listKey, dataList);
  }

  return dataList as T[];
}

/**
 * Insert a record
 */
export async function insertRecord<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  data: Partial<T>,
  options?: TableOptions
): Promise<string> {
  const db = getKnex(options);
  const cache = getCache();

  const insertData = { ...data } as Record<string, unknown>;
  if (!insertData.id) {
    insertData.id = genId();
  }
  const now = new Date();
  if (!insertData.created_at) insertData.created_at = now;
  if (!insertData.updated_at) insertData.updated_at = now;

  await db(metaTable).insert(insertData);

  if (!options?.skipCache) {
    await cache.set(`${cacheScope}:${insertData.id}`, insertData);
  }

  return insertData.id as string;
}

/**
 * Update a record
 */
export async function updateRecord<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  data: Partial<T>,
  options?: TableOptions
): Promise<void> {
  const db = getKnex(options);
  const cache = getCache();

  const updateData = { ...data, updated_at: new Date() } as Record<string, unknown>;
  await db(metaTable).where('id', id).update(updateData);

  if (!options?.skipCache) {
    const cached = await cache.get<T>(`${cacheScope}:${id}`);
    if (cached) {
      await cache.set(`${cacheScope}:${id}`, { ...cached, ...updateData });
    }
  }
}

/**
 * Delete a record
 */
export async function deleteRecord(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  options?: TableOptions
): Promise<number> {
  const db = getKnex(options);
  const cache = getCache();

  const result = await db(metaTable).where('id', id).delete();

  if (!options?.skipCache) {
    await cache.del(`${cacheScope}:${id}`);
  }

  return result;
}

/**
 * Count records
 */
export async function countRecords(
  metaTable: MetaTable,
  condition?: Record<string, unknown>,
  options?: TableOptions
): Promise<number> {
  const db = getKnex(options);
  let query = db(metaTable);
  if (condition) {
    query = query.where(condition);
  }
  const result = await query.count({ count: '*' }).first();
  return Number(result?.count || 0);
}

/**
 * Invalidate list cache
 */
export async function invalidateListCache(
  cacheScope: CacheScope,
  parentId: string
): Promise<void> {
  const cache = getCache();
  await cache.invalidateList(cacheScope, parentId);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply extended condition (supports nested AND/OR)
 */
function applyXcCondition(
  query: Knex.QueryBuilder,
  xcCondition: Record<string, unknown>
): Knex.QueryBuilder {
  if (xcCondition._and) {
    query = query.where((qb) => {
      for (const cond of xcCondition._and as Record<string, unknown>[]) {
        applyXcCondition(qb, cond);
      }
    });
  }

  if (xcCondition._or) {
    query = query.where((qb) => {
      let first = true;
      for (const cond of xcCondition._or as Record<string, unknown>[]) {
        if (first) {
          applyXcCondition(qb, cond);
          first = false;
        } else {
          qb.orWhere((innerQb) => {
            applyXcCondition(innerQb, cond);
          });
        }
      }
    });
  }

  for (const [key, value] of Object.entries(xcCondition)) {
    if (key.startsWith('_')) continue;
    if (value === null) {
      query = query.whereNull(key);
    } else if (typeof value === 'object' && value !== null) {
      const condition = value as Record<string, unknown>;
      if (condition.eq !== undefined) query = query.where(key, condition.eq as any);
      if (condition.neq !== undefined) query = query.whereNot(key, condition.neq as any);
      if (condition.like !== undefined) query = query.where(key, 'like', condition.like as string);
      if (condition.gt !== undefined) query = query.where(key, '>', condition.gt as any);
      if (condition.gte !== undefined) query = query.where(key, '>=', condition.gte as any);
      if (condition.lt !== undefined) query = query.where(key, '<', condition.lt as any);
      if (condition.lte !== undefined) query = query.where(key, '<=', condition.lte as any);
      if (condition.in !== undefined && Array.isArray(condition.in)) {
        query = query.whereIn(key, condition.in as any[]);
      }
    } else {
      query = query.where(key, value as any);
    }
  }

  return query;
}

// Export Model as default
export default Model;
