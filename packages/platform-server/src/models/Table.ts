/**
 * Table - Base class for metadata table operations
 * @module models/Table
 */

import type { Knex } from 'knex';
import { NocoCache } from '../cache/index.js';
import { getDb, generateId } from '../db/index.js';
import { CacheScope, MetaTable } from '../types/index.js';

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
// Table Class
// ============================================================================

/**
 * Table - Base class for metadata table operations with caching support
 */
export class Table {
  /** The cache scope for this table */
  protected readonly cacheScope: CacheScope;
  
  /** The metadata table name */
  protected readonly metaTable: MetaTable;
  
  /** Cache instance */
  protected readonly cache: NocoCache;

  constructor(cacheScope: CacheScope, metaTable: MetaTable) {
    this.cacheScope = cacheScope;
    this.metaTable = metaTable;
    this.cache = NocoCache.getInstance();
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getCacheScope(): CacheScope {
    return this.cacheScope;
  }

  getMetaTable(): MetaTable {
    return this.metaTable;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get Knex instance (custom or default)
   */
  protected getKnex(options?: TableOptions): Knex {
    return options?.knex || getDb();
  }

  /**
   * Generate a new ID using ULID
   */
  genId(): string {
    return generateId();
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Get a single record by ID
   */
  async getById<T extends object>(
    id: string,
    options?: TableOptions
  ): Promise<T | null> {
    const db = this.getKnex(options);

    if (!options?.skipCache) {
      const cached = await this.cache.get<T>(`${this.cacheScope}:${id}`);
      if (cached) return cached;
    }

    const data = await db(this.metaTable).where('id', id).first();
    if (!data) return null;

    if (!options?.skipCache) {
      await this.cache.set(`${this.cacheScope}:${id}`, data);
    }

    return data as T;
  }

  /**
   * Get a single record by condition
   */
  async getByCondition<T extends object>(
    condition: Record<string, unknown>,
    options?: TableOptions
  ): Promise<T | null> {
    const db = this.getKnex(options);
    const data = await db(this.metaTable).where(condition).first();
    return (data as T) || null;
  }

  /**
   * List records with optional filtering
   */
  async listRecords<T extends object>(
    listKey: string,
    listOptions?: QueryOptions,
    options?: TableOptions
  ): Promise<T[]> {
    const db = this.getKnex(options);

    if (!options?.skipCache) {
      const cached = await this.cache.getList<T>(this.cacheScope, listKey);
      if (cached) return cached;
    }

    let query = db(this.metaTable);

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
      query = this.applyXcCondition(query, listOptions.xcCondition);
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
      await this.cache.setList(this.cacheScope, listKey, dataList);
    }

    return dataList as T[];
  }

  /**
   * Insert a record
   */
  async insertRecord<T extends object>(
    data: Partial<T>,
    options?: TableOptions
  ): Promise<string> {
    const db = this.getKnex(options);

    const insertData = { ...data } as Record<string, unknown>;
    if (!insertData.id) {
      insertData.id = this.genId();
    }
    const now = new Date();
    if (!insertData.created_at) insertData.created_at = now;
    if (!insertData.updated_at) insertData.updated_at = now;

    await db(this.metaTable).insert(insertData);

    if (!options?.skipCache) {
      await this.cache.set(`${this.cacheScope}:${insertData.id}`, insertData);
    }

    return insertData.id as string;
  }

  /**
   * Update a record
   */
  async updateRecord<T extends object>(
    id: string,
    data: Partial<T>,
    options?: TableOptions
  ): Promise<void> {
    const db = this.getKnex(options);

    const updateData = { ...data, updated_at: new Date() } as Record<string, unknown>;
    await db(this.metaTable).where('id', id).update(updateData);

    if (!options?.skipCache) {
      const cached = await this.cache.get<T>(`${this.cacheScope}:${id}`);
      if (cached) {
        await this.cache.set(`${this.cacheScope}:${id}`, { ...cached, ...updateData });
      }
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(
    id: string,
    options?: TableOptions
  ): Promise<number> {
    const db = this.getKnex(options);

    const result = await db(this.metaTable).where('id', id).delete();

    if (!options?.skipCache) {
      await this.cache.del(`${this.cacheScope}:${id}`);
    }

    return result;
  }

  /**
   * Count records
   */
  async countRecords(
    condition?: Record<string, unknown>,
    options?: TableOptions
  ): Promise<number> {
    const db = this.getKnex(options);
    let query = db(this.metaTable);
    if (condition) {
      query = query.where(condition);
    }
    const result = await query.count({ count: '*' }).first();
    return Number(result?.count || 0);
  }

  /**
   * Invalidate list cache
   */
  async invalidateListCache(parentId: string): Promise<void> {
    await this.cache.invalidateList(this.cacheScope, parentId);
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Apply extended condition (supports nested AND/OR)
   */
  protected applyXcCondition(
    query: Knex.QueryBuilder,
    xcCondition: Record<string, unknown>
  ): Knex.QueryBuilder {
    if (xcCondition._and) {
      query = query.where((qb) => {
        for (const cond of xcCondition._and as Record<string, unknown>[]) {
          this.applyXcCondition(qb, cond);
        }
      });
    }

    if (xcCondition._or) {
      query = query.where((qb) => {
        let first = true;
        for (const cond of xcCondition._or as Record<string, unknown>[]) {
          if (first) {
            this.applyXcCondition(qb, cond);
            first = false;
          } else {
            qb.orWhere((innerQb) => {
              this.applyXcCondition(innerQb, cond);
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
}

// ============================================================================
// Backward Compatibility - Static Helper Functions
// ============================================================================

// These functions provide backward compatibility for existing code that uses
// the old function-based API. They create a temporary Table instance for each call.

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

/**
 * Get a single record by ID
 */
export async function getById<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  options?: TableOptions
): Promise<T | null> {
  const table = new Table(cacheScope, metaTable);
  return table.getById<T>(id, options);
}

/**
 * Get a single record by condition
 */
export async function getByCondition<T extends object>(
  metaTable: MetaTable,
  condition: Record<string, unknown>,
  options?: TableOptions
): Promise<T | null> {
  // Use a dummy cache scope since getByCondition doesn't use caching
  const table = new Table(CacheScope.PROJECT, metaTable);
  return table.getByCondition<T>(condition, options);
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
  const table = new Table(cacheScope, metaTable);
  return table.listRecords<T>(listKey, listOptions, options);
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
  const table = new Table(cacheScope, metaTable);
  return table.insertRecord<T>(data, options);
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
  const table = new Table(cacheScope, metaTable);
  return table.updateRecord<T>(id, data, options);
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
  const table = new Table(cacheScope, metaTable);
  return table.deleteRecord(id, options);
}

/**
 * Count records
 */
export async function countRecords(
  metaTable: MetaTable,
  condition?: Record<string, unknown>,
  options?: TableOptions
): Promise<number> {
  // Use a dummy cache scope since countRecords doesn't use caching
  const table = new Table(CacheScope.PROJECT, metaTable);
  return table.countRecords(condition, options);
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

export default Table;
