/**
 * Base Model - Generic base class for all entity models
 * 
 * Provides common CRUD operations with caching support
 * to reduce boilerplate in entity models.
 * 
 * @module models/BaseModel
 */

import type { Knex } from 'knex';
import { NocoCache } from '../cache/index.js';
import { getDb, generateId } from '../db/index.js';
import { CacheScope, MetaTable, type BaseEntity } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for model operations
 */
export interface ModelOptions {
  /** Custom Knex instance (for transactions) */
  knex?: Knex;
  /** Skip cache operations */
  skipCache?: boolean;
}

/**
 * Query options for list operations
 */
export interface QueryOptions {
  /** WHERE conditions */
  condition?: Record<string, unknown>;
  /** Extended conditions with operators */
  conditionArr?: Array<{ key: string; value: unknown; op?: string }>;
  /** ORDER BY clause */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** LIMIT clause */
  limit?: number;
  /** OFFSET clause */
  offset?: number;
}

// ============================================================================
// Cache Key Builder
// ============================================================================

/**
 * Build standardized cache keys
 */
export const CacheKey = {
  /** Entity by ID */
  entity: (scope: CacheScope, id: string) => `${scope}:${id}`,
  
  /** Entity list */
  list: (scope: CacheScope, key: string) => `${scope}:list:${key}`,
  
  /** Secondary index (e.g., user by email) */
  index: (scope: CacheScope, field: string, value: string) => 
    `${scope}:${field}:${value}`,
  
  /** Scope pattern for bulk invalidation */
  pattern: (scope: CacheScope) => `${scope}:*`,
} as const;

// ============================================================================
// Base Model Class
// ============================================================================

/**
 * Abstract base model class with common CRUD operations
 * 
 * @example
 * ```typescript
 * class User extends BaseModel<UserType> {
 *   static readonly scope = CacheScope.USER;
 *   static readonly table = MetaTable.USERS;
 * 
 *   get email(): string { return this.data.email; }
 * }
 * ```
 */
export abstract class BaseModel<T extends BaseEntity> {
  protected data: T;

  constructor(data: T) {
    this.data = data;
  }

  // ========== Abstract Properties ==========
  
  /** Cache scope for this model */
  protected abstract get scope(): CacheScope;
  
  /** Database table name */
  protected abstract get table(): MetaTable;

  // ========== Getters ==========

  get id(): string {
    return this.data.id;
  }

  get createdAt(): Date {
    return this.data.created_at;
  }

  get updatedAt(): Date {
    return this.data.updated_at;
  }

  /**
   * Get raw data object
   */
  getData(): T {
    return this.data;
  }

  /**
   * Get JSON representation
   */
  toJSON(): T {
    return { ...this.data };
  }

  // ========== Protected Static Helpers ==========

  protected static getDb(options?: ModelOptions): Knex {
    return options?.knex || getDb();
  }

  protected static getCache(): NocoCache {
    return NocoCache.getInstance();
  }

  // ========== Generic CRUD Operations ==========

  /**
   * Get a single record by ID with caching
   */
  protected static async getById<T extends BaseEntity>(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    options?: ModelOptions
  ): Promise<T | null> {
    const cache = this.getCache();
    const cacheKey = CacheKey.entity(scope, id);

    // Try cache first
    if (!options?.skipCache) {
      const cached = await cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    // Query database
    const db = this.getDb(options);
    const data = await db(table).where('id', id).first();
    if (!data) return null;

    // Store in cache
    if (!options?.skipCache) {
      await cache.set(cacheKey, data);
    }

    return data as T;
  }

  /**
   * Get a single record by condition (no caching)
   */
  protected static async getByCondition<T extends BaseEntity>(
    table: MetaTable,
    condition: Record<string, unknown>,
    options?: ModelOptions
  ): Promise<T | null> {
    const db = this.getDb(options);
    const data = await db(table).where(condition).first();
    return (data as T) || null;
  }

  /**
   * List records with caching
   */
  protected static async listRecords<T extends BaseEntity>(
    scope: CacheScope,
    table: MetaTable,
    listKey: string,
    queryOptions?: QueryOptions,
    options?: ModelOptions
  ): Promise<T[]> {
    const cache = this.getCache();
    const cacheKey = CacheKey.list(scope, listKey);

    // Try cache first
    if (!options?.skipCache) {
      const cached = await cache.getList<T>(scope, listKey);
      if (cached) return cached;
    }

    // Build query
    const db = this.getDb(options);
    let query = db(table);

    if (queryOptions?.condition) {
      query = query.where(queryOptions.condition);
    }

    if (queryOptions?.conditionArr) {
      for (const cond of queryOptions.conditionArr) {
        query = this.applyCondition(query, cond);
      }
    }

    if (queryOptions?.orderBy) {
      for (const [col, dir] of Object.entries(queryOptions.orderBy)) {
        query = query.orderBy(col, dir);
      }
    }

    if (queryOptions?.limit) query = query.limit(queryOptions.limit);
    if (queryOptions?.offset) query = query.offset(queryOptions.offset);

    const results = await query;

    // Store in cache
    if (!options?.skipCache) {
      await cache.setList(scope, listKey, results);
    }

    return results as T[];
  }

  /**
   * Insert a new record
   */
  protected static async insertRecord<T extends BaseEntity>(
    scope: CacheScope,
    table: MetaTable,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>,
    options?: ModelOptions
  ): Promise<string> {
    const db = this.getDb(options);
    const cache = this.getCache();
    const now = new Date();

    const record = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    await db(table).insert(record);

    // Cache the new record
    if (!options?.skipCache) {
      await cache.set(CacheKey.entity(scope, record.id), record);
    }

    return record.id;
  }

  /**
   * Update a record by ID
   */
  protected static async updateRecord<T extends BaseEntity>(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    data: Partial<T>,
    options?: ModelOptions
  ): Promise<void> {
    const db = this.getDb(options);
    const cache = this.getCache();

    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    await db(table).where('id', id).update(updateData);

    // Invalidate cache (next read will refresh)
    if (!options?.skipCache) {
      await cache.del(CacheKey.entity(scope, id));
    }
  }

  /**
   * Delete a record by ID
   */
  protected static async deleteRecord(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    options?: ModelOptions
  ): Promise<number> {
    const db = this.getDb(options);
    const cache = this.getCache();

    const result = await db(table).where('id', id).delete();

    // Remove from cache
    if (!options?.skipCache) {
      await cache.del(CacheKey.entity(scope, id));
    }

    return result;
  }

  /**
   * Count records
   */
  protected static async countRecords(
    table: MetaTable,
    condition?: Record<string, unknown>,
    options?: ModelOptions
  ): Promise<number> {
    const db = this.getDb(options);
    let query = db(table);
    if (condition) {
      query = query.where(condition);
    }
    const result = await query.count({ count: '*' }).first();
    return Number(result?.count || 0);
  }

  /**
   * Invalidate list cache
   */
  protected static async invalidateListCache(
    scope: CacheScope,
    listKey: string
  ): Promise<void> {
    const cache = this.getCache();
    await cache.invalidateList(scope, listKey);
  }

  /**
   * Apply a single condition to query
   */
  protected static applyCondition(
    query: Knex.QueryBuilder,
    cond: { key: string; value: unknown; op?: string }
  ): Knex.QueryBuilder {
    const op = cond.op || '=';
    
    switch (op) {
      case 'is':
        return cond.value === null 
          ? query.whereNull(cond.key)
          : query.where(cond.key, cond.value as string);
      case 'is not':
        return cond.value === null
          ? query.whereNotNull(cond.key)
          : query.whereNot(cond.key, cond.value as string);
      case 'in':
        return Array.isArray(cond.value)
          ? query.whereIn(cond.key, cond.value)
          : query;
      case 'like':
        return query.where(cond.key, 'like', cond.value as string);
      default:
        return query.where(cond.key, op, cond.value as string);
    }
  }
}

// ============================================================================
// Re-export legacy helpers for backward compatibility
// ============================================================================

export {
  type TableOptions,
  getById,
  getByCondition,
  listRecords,
  insertRecord,
  updateRecord,
  deleteRecord,
  countRecords,
  invalidateListCache,
} from './Table.js';
