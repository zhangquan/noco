/**
 * Schema Model - Unified schema management for Table, Page, Flow
 * Supports JSON Patch (RFC 6902) based updates
 * @module models/Schema
 */

import type { Knex } from 'knex';
import { CacheScope, MetaTable, type SchemaDomain, type SchemaEnv } from '../types/index.js';
import { getDb, generateId } from '../db/index.js';
import { NocoCache } from '../cache/index.js';
import {
  getById,
  updateRecord,
  deleteRecord,
  listRecords,
  type TableOptions,
} from './Table.js';

// ============================================================================
// Types
// ============================================================================

/**
 * JSON Patch operation types (RFC 6902)
 */
export type JsonPatchOp = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

/**
 * JSON Patch operation (RFC 6902)
 */
export interface JsonPatchOperation {
  /** Operation type */
  op: JsonPatchOp;
  /** Target path (JSON Pointer) */
  path: string;
  /** Value for add/replace/test operations */
  value?: unknown;
  /** Source path for move/copy operations */
  from?: string;
}

/**
 * Schema data record stored in database
 */
export interface SchemaRecord {
  id: string;
  /** Domain: 'model' | 'page' | 'flow' | 'app' */
  domain: SchemaDomain;
  /** Foreign key to domain entity (model_id, page_id, flow_id) */
  fk_domain_id: string;
  /** Project ID */
  fk_project_id: string;
  /** Schema JSON data */
  data: Record<string, unknown>;
  /** Environment: 'DEV' | 'PRO' */
  env: SchemaEnv;
  /** Schema version (auto-incremented) */
  version: number;
  /** Created timestamp */
  created_at: Date;
  /** Updated timestamp */
  updated_at: Date;
}

/**
 * Schema create options
 */
export interface SchemaCreateOptions {
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data?: Record<string, unknown>;
  env?: SchemaEnv;
}

/**
 * Schema update result with applied patches
 */
export interface SchemaPatchResult {
  schema: Schema;
  appliedPatches: JsonPatchOperation[];
  newVersion: number;
}

const CACHE_SCOPE = CacheScope.SCHEMA;
const META_TABLE = MetaTable.SCHEMAS;

// ============================================================================
// Schema Class
// ============================================================================

/**
 * Schema Model - Core abstraction for JSON schema management
 * 
 * Used by Table, Page, Flow for unified schema handling.
 * Supports JSON Patch (RFC 6902) for incremental updates.
 * 
 * @example
 * ```typescript
 * // Create a new schema
 * const schema = await Schema.create({
 *   domain: 'model',
 *   fk_domain_id: tableId,
 *   fk_project_id: projectId,
 *   data: { columns: [], views: [] }
 * });
 * 
 * // Apply JSON Patch updates
 * const result = await schema.applyPatch([
 *   { op: 'add', path: '/columns/-', value: { id: 'col1', title: 'Name' } },
 *   { op: 'replace', path: '/columns/0/title', value: 'Full Name' }
 * ]);
 * 
 * // Get value at path
 * const columns = schema.getAtPath('/columns');
 * 
 * // Set value at path
 * await schema.setAtPath('/views/0/title', 'Grid View');
 * ```
 */
export class Schema {
  private _data: SchemaRecord;

  constructor(data: SchemaRecord) {
    this._data = data;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this._data.id; }
  get domain(): SchemaDomain { return this._data.domain; }
  get domainId(): string { return this._data.fk_domain_id; }
  get projectId(): string { return this._data.fk_project_id; }
  get data(): Record<string, unknown> { return this._data.data || {}; }
  get env(): SchemaEnv { return this._data.env; }
  get version(): number { return this._data.version || 1; }
  get createdAt(): Date { return this._data.created_at; }
  get updatedAt(): Date { return this._data.updated_at; }

  /**
   * Get raw schema record
   */
  getData(): SchemaRecord {
    return { ...this._data };
  }

  /**
   * Convert to JSON
   */
  toJSON(): SchemaRecord {
    return this.getData();
  }

  // ==========================================================================
  // JSON Patch Operations (RFC 6902)
  // ==========================================================================

  /**
   * Apply JSON Patch operations to schema data
   * @param patches - Array of JSON Patch operations
   * @param options - Database options
   * @returns Result with applied patches and new version
   */
  async applyPatch(
    patches: JsonPatchOperation[],
    options?: TableOptions
  ): Promise<SchemaPatchResult> {
    const data = JSON.parse(JSON.stringify(this._data.data || {}));
    const appliedPatches: JsonPatchOperation[] = [];

    for (const patch of patches) {
      try {
        this.applyOperation(data, patch);
        appliedPatches.push(patch);
      } catch (error) {
        // If any patch fails, we stop and return what was applied
        console.error(`JSON Patch operation failed:`, patch, error);
        break;
      }
    }

    if (appliedPatches.length === 0) {
      return { schema: this, appliedPatches: [], newVersion: this.version };
    }

    // Update in database with new version
    const newVersion = this.version + 1;
    await Schema.update(
      this.id,
      { data, version: newVersion },
      options
    );

    // Update local data
    this._data.data = data;
    this._data.version = newVersion;
    this._data.updated_at = new Date();

    return { schema: this, appliedPatches, newVersion };
  }

  /**
   * Apply a single JSON Patch operation to an object
   */
  private applyOperation(obj: Record<string, unknown>, patch: JsonPatchOperation): void {
    const { op, path, value, from } = patch;

    switch (op) {
      case 'add':
        this.addValue(obj, path, value);
        break;
      case 'remove':
        this.removeValue(obj, path);
        break;
      case 'replace':
        this.replaceValue(obj, path, value);
        break;
      case 'move':
        if (!from) throw new Error('move operation requires "from" path');
        const moveValue = this.getValueAtPath(obj, from);
        this.removeValue(obj, from);
        this.addValue(obj, path, moveValue);
        break;
      case 'copy':
        if (!from) throw new Error('copy operation requires "from" path');
        const copyValue = this.getValueAtPath(obj, from);
        this.addValue(obj, path, JSON.parse(JSON.stringify(copyValue)));
        break;
      case 'test':
        const testValue = this.getValueAtPath(obj, path);
        if (JSON.stringify(testValue) !== JSON.stringify(value)) {
          throw new Error(`test operation failed at path: ${path}`);
        }
        break;
      default:
        throw new Error(`Unknown JSON Patch operation: ${op}`);
    }
  }

  /**
   * Parse JSON Pointer path to array of keys
   */
  private parsePath(path: string): string[] {
    if (path === '' || path === '/') return [];
    if (!path.startsWith('/')) {
      throw new Error(`Invalid JSON Pointer: ${path}`);
    }
    return path.slice(1).split('/').map(segment =>
      segment.replace(/~1/g, '/').replace(/~0/g, '~')
    );
  }

  /**
   * Get value at JSON Pointer path
   */
  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const keys = this.parsePath(path);
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        throw new Error(`Cannot access path: ${path}`);
      }
      if (Array.isArray(current)) {
        const index = key === '-' ? current.length : parseInt(key, 10);
        current = current[index];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        throw new Error(`Cannot access path: ${path}`);
      }
    }

    return current;
  }

  /**
   * Set value at JSON Pointer path
   */
  private setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot set root path');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        const index = parseInt(key, 10);
        current = current[index];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      } else {
        throw new Error(`Cannot set path: ${path}`);
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      const index = lastKey === '-' ? current.length : parseInt(lastKey, 10);
      current[index] = value;
    } else if (typeof current === 'object' && current !== null) {
      (current as Record<string, unknown>)[lastKey] = value;
    } else {
      throw new Error(`Cannot set path: ${path}`);
    }
  }

  /**
   * Add value at path (for 'add' operation)
   */
  private addValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot add at root path');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        current = current[parseInt(key, 10)];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      const index = lastKey === '-' ? current.length : parseInt(lastKey, 10);
      if (lastKey === '-') {
        current.push(value);
      } else {
        current.splice(index, 0, value);
      }
    } else if (typeof current === 'object' && current !== null) {
      (current as Record<string, unknown>)[lastKey] = value;
    }
  }

  /**
   * Remove value at path (for 'remove' operation)
   */
  private removeValue(obj: Record<string, unknown>, path: string): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot remove root');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        current = current[parseInt(key, 10)];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      current.splice(parseInt(lastKey, 10), 1);
    } else if (typeof current === 'object' && current !== null) {
      delete (current as Record<string, unknown>)[lastKey];
    }
  }

  /**
   * Replace value at path (for 'replace' operation)
   */
  private replaceValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    // First verify the path exists
    this.getValueAtPath(obj, path);
    // Then set the new value
    this.setValueAtPath(obj, path, value);
  }

  // ==========================================================================
  // Convenience Methods for Data Access
  // ==========================================================================

  /**
   * Get value at JSON Pointer path from schema data
   * @param path - JSON Pointer path (e.g., '/columns/0/title')
   * @returns Value at path or undefined
   */
  getAtPath<T = unknown>(path: string): T | undefined {
    try {
      return this.getValueAtPath(this._data.data || {}, path) as T;
    } catch {
      return undefined;
    }
  }

  /**
   * Set value at JSON Pointer path and save
   * @param path - JSON Pointer path
   * @param value - Value to set
   * @param options - Database options
   */
  async setAtPath(path: string, value: unknown, options?: TableOptions): Promise<void> {
    await this.applyPatch([{ op: 'replace', path, value }], options);
  }

  /**
   * Add value at JSON Pointer path and save
   * @param path - JSON Pointer path (use '/-' suffix for array append)
   * @param value - Value to add
   * @param options - Database options
   */
  async addAtPath(path: string, value: unknown, options?: TableOptions): Promise<void> {
    await this.applyPatch([{ op: 'add', path, value }], options);
  }

  /**
   * Remove value at JSON Pointer path and save
   * @param path - JSON Pointer path
   * @param options - Database options
   */
  async removeAtPath(path: string, options?: TableOptions): Promise<void> {
    await this.applyPatch([{ op: 'remove', path }], options);
  }

  // ==========================================================================
  // Instance Update Methods
  // ==========================================================================

  /**
   * Update schema data completely (full replace)
   * @param data - New schema data
   * @param options - Database options
   */
  async updateData(data: Record<string, unknown>, options?: TableOptions): Promise<void> {
    const newVersion = this.version + 1;
    await Schema.update(this.id, { data, version: newVersion }, options);
    this._data.data = data;
    this._data.version = newVersion;
    this._data.updated_at = new Date();
  }

  /**
   * Merge data into schema (shallow merge)
   * @param data - Data to merge
   * @param options - Database options
   */
  async mergeData(data: Record<string, unknown>, options?: TableOptions): Promise<void> {
    const mergedData = { ...this._data.data, ...data };
    await this.updateData(mergedData, options);
  }

  /**
   * Publish schema (copy DEV to PRO)
   * @param options - Database options
   * @returns Published schema
   */
  async publish(options?: TableOptions): Promise<Schema> {
    if (this.env !== 'DEV') {
      throw new Error('Only DEV schemas can be published');
    }

    // Find existing PRO schema or create new one
    const existingPro = await Schema.getByDomainAndEnv(
      this.domain,
      this.domainId,
      'PRO',
      options
    );

    if (existingPro) {
      // Update existing PRO schema
      await existingPro.updateData(this.data, options);
      return existingPro;
    }

    // Create new PRO schema
    return Schema.create({
      domain: this.domain,
      fk_domain_id: this.domainId,
      fk_project_id: this.projectId,
      data: this.data,
      env: 'PRO',
    }, options);
  }

  // ==========================================================================
  // Static Methods - CRUD Operations
  // ==========================================================================

  /**
   * Get schema by ID
   */
  static async get(id: string, options?: TableOptions): Promise<Schema | null> {
    const data = await getById<SchemaRecord>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Schema(data) : null;
  }

  /**
   * Get schema by domain entity and environment
   */
  static async getByDomainAndEnv(
    domain: SchemaDomain,
    domainId: string,
    env: SchemaEnv = 'DEV',
    options?: TableOptions
  ): Promise<Schema | null> {
    const db = options?.knex || getDb();
    const data = await db(META_TABLE)
      .where({
        domain,
        fk_domain_id: domainId,
        env,
      })
      .orderBy('version', 'desc')
      .first();
    
    return data ? new Schema(data) : null;
  }

  /**
   * Get or create schema for domain entity
   */
  static async getOrCreate(
    createOptions: SchemaCreateOptions,
    options?: TableOptions
  ): Promise<Schema> {
    const existing = await Schema.getByDomainAndEnv(
      createOptions.domain,
      createOptions.fk_domain_id,
      createOptions.env || 'DEV',
      options
    );

    if (existing) {
      return existing;
    }

    return Schema.create(createOptions, options);
  }

  /**
   * Create a new schema
   */
  static async create(
    createOptions: SchemaCreateOptions,
    options?: TableOptions
  ): Promise<Schema> {
    const db = options?.knex || getDb();
    const cache = NocoCache.getInstance();
    const now = new Date();
    const id = generateId();

    const schemaData: Partial<SchemaRecord> = {
      id,
      domain: createOptions.domain,
      fk_domain_id: createOptions.fk_domain_id,
      fk_project_id: createOptions.fk_project_id,
      data: createOptions.data || {},
      env: createOptions.env || 'DEV',
      version: 1,
      created_at: now,
      updated_at: now,
    };

    await db(META_TABLE).insert(schemaData);

    const schema = await this.get(id, { ...options, skipCache: true });
    if (!schema) throw new Error('Failed to create schema');

    if (!options?.skipCache) {
      await cache.set(`${CACHE_SCOPE}:${id}`, schema.getData());
      await cache.invalidateList(CACHE_SCOPE, createOptions.fk_project_id);
    }

    return schema;
  }

  /**
   * Update schema record
   */
  static async update(
    id: string,
    data: Partial<Pick<SchemaRecord, 'data' | 'version' | 'env'>>,
    options?: TableOptions
  ): Promise<void> {
    const schema = await this.get(id, options);
    await updateRecord<SchemaRecord>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (schema && !options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.invalidateList(CACHE_SCOPE, schema.projectId);
    }
  }

  /**
   * Delete schema
   */
  static async delete(id: string, options?: TableOptions): Promise<number> {
    const schema = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (schema && !options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.invalidateList(CACHE_SCOPE, schema.projectId);
    }
    return result;
  }

  /**
   * Delete all schemas for a domain entity
   */
  static async deleteByDomain(
    domain: SchemaDomain,
    domainId: string,
    options?: TableOptions
  ): Promise<number> {
    const db = options?.knex || getDb();
    const result = await db(META_TABLE)
      .where({ domain, fk_domain_id: domainId })
      .delete();

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      // Clear related caches
      await cache.invalidateList(CACHE_SCOPE, domainId);
    }

    return result;
  }

  /**
   * List schemas for a project
   */
  static async listForProject(
    projectId: string,
    domain?: SchemaDomain,
    options?: TableOptions
  ): Promise<Schema[]> {
    const condition: Record<string, unknown> = { fk_project_id: projectId };
    if (domain) {
      condition.domain = domain;
    }

    const data = await listRecords<SchemaRecord>(
      CACHE_SCOPE,
      META_TABLE,
      domain ? `${projectId}:${domain}` : projectId,
      { condition, orderBy: { created_at: 'desc' } },
      options
    );

    return data.map(d => new Schema(d));
  }

  /**
   * List schema versions for a domain entity
   */
  static async listVersions(
    domain: SchemaDomain,
    domainId: string,
    env: SchemaEnv = 'DEV',
    options?: TableOptions
  ): Promise<Schema[]> {
    const db = options?.knex || getDb();
    const data = await db(META_TABLE)
      .where({ domain, fk_domain_id: domainId, env })
      .orderBy('version', 'desc');

    return data.map((d: SchemaRecord) => new Schema(d));
  }

  /**
   * Get specific version of schema
   */
  static async getVersion(
    domain: SchemaDomain,
    domainId: string,
    version: number,
    env: SchemaEnv = 'DEV',
    options?: TableOptions
  ): Promise<Schema | null> {
    const db = options?.knex || getDb();
    const data = await db(META_TABLE)
      .where({ domain, fk_domain_id: domainId, env, version })
      .first();

    return data ? new Schema(data) : null;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clone schema to another domain entity
   */
  static async clone(
    sourceId: string,
    targetDomainId: string,
    options?: TableOptions
  ): Promise<Schema> {
    const source = await this.get(sourceId, options);
    if (!source) {
      throw new Error(`Source schema not found: ${sourceId}`);
    }

    return Schema.create({
      domain: source.domain,
      fk_domain_id: targetDomainId,
      fk_project_id: source.projectId,
      data: JSON.parse(JSON.stringify(source.data)),
      env: 'DEV',
    }, options);
  }

  /**
   * Compare two schemas and generate patches
   */
  static diff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): JsonPatchOperation[] {
    return generateDiff(oldData, newData, '');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate JSON Patch operations from two objects
 * Simple diff implementation (not RFC 6902 compliant for all edge cases)
 */
function generateDiff(
  oldObj: unknown,
  newObj: unknown,
  path: string
): JsonPatchOperation[] {
  const patches: JsonPatchOperation[] = [];

  // Handle null/undefined
  if (oldObj === newObj) return patches;
  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      patches.push({ op: 'add', path: path || '/', value: newObj });
    }
    return patches;
  }
  if (newObj === null || newObj === undefined) {
    patches.push({ op: 'remove', path });
    return patches;
  }

  // Handle different types
  const oldType = Array.isArray(oldObj) ? 'array' : typeof oldObj;
  const newType = Array.isArray(newObj) ? 'array' : typeof newObj;

  if (oldType !== newType) {
    patches.push({ op: 'replace', path, value: newObj });
    return patches;
  }

  // Handle primitives
  if (oldType !== 'object' && oldType !== 'array') {
    if (oldObj !== newObj) {
      patches.push({ op: 'replace', path, value: newObj });
    }
    return patches;
  }

  // Handle arrays
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    // Simple array diff - replace if different
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      patches.push({ op: 'replace', path, value: newObj });
    }
    return patches;
  }

  // Handle objects
  const oldRecord = oldObj as Record<string, unknown>;
  const newRecord = newObj as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  for (const key of allKeys) {
    const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
    const childPath = path ? `${path}/${escapedKey}` : `/${escapedKey}`;

    if (!(key in oldRecord)) {
      patches.push({ op: 'add', path: childPath, value: newRecord[key] });
    } else if (!(key in newRecord)) {
      patches.push({ op: 'remove', path: childPath });
    } else {
      patches.push(...generateDiff(oldRecord[key], newRecord[key], childPath));
    }
  }

  return patches;
}

export default Schema;
