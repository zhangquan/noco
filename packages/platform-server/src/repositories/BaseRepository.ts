/**
 * Base Repository
 * Provides common data access operations for all repositories
 * @module repositories/BaseRepository
 */

import type { Knex } from 'knex';
import { NocoCache } from '../cache/index.js';
import { getDb, generateId } from '../db/index.js';
import { CacheScope, MetaTable } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Repository operation options
 */
export interface RepositoryOptions {
  /** Custom Knex instance (for transactions) */
  knex?: Knex;
  /** Skip cache operations */
  skipCache?: boolean;
}

/**
 * Query options for list operations
 */
export interface QueryOptions extends RepositoryOptions {
  /** Filter conditions */
  condition?: Record<string, unknown>;
  /** Condition array with operators */
  conditionArr?: Array<{ key: string; value: unknown; op?: string }>;
  /** Order by columns */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Limit results */
  limit?: number;
  /** Offset results */
  offset?: number;
  /** Extended condition (supports nested AND/OR) */
  xcCondition?: Record<string, unknown>;
}

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: string;
  created_at?: Date;
  updated_at?: Date;
}

// ============================================================================
// Base Repository Class
// ============================================================================

/**
 * Abstract base repository providing common CRUD operations
 * 
 * @example
 * ```typescript
 * class UserRepository extends BaseRepository<UserRecord> {
 *   protected tableName = MetaTable.USERS;
 *   protected cacheScope = CacheScope.USER;
 *   
 *   async getByEmail(email: string, options?: RepositoryOptions): Promise<UserRecord | null> {
 *     return this.findOne({ email: email.toLowerCase() }, options);
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<T extends BaseEntity> {
  /** Database table name */
  protected abstract tableName: MetaTable;
  /** Cache scope for this entity */
  protected abstract cacheScope: CacheScope;

  // ==========================================================================
  // Core CRUD Operations
  // ==========================================================================

  /**
   * Get entity by ID
   */
  async getById(id: string, options?: RepositoryOptions): Promise<T | null> {
    const cache = this.getCache();
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (!options?.skipCache) {
      const cached = await cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    const db = this.getDb(options);
    const data = await db(this.tableName).where('id', id).first();

    if (!data) return null;

    // Update cache
    if (!options?.skipCache) {
      await cache.set(cacheKey, data);
    }

    return data as T;
  }

  /**
   * Find one entity by conditions
   */
  async findOne(where: Record<string, unknown>, options?: RepositoryOptions): Promise<T | null> {
    const db = this.getDb(options);
    const data = await db(this.tableName).where(where).first();
    return (data as T) || null;
  }

  /**
   * Find all entities matching conditions
   */
  async findMany(options?: QueryOptions): Promise<T[]> {
    const db = this.getDb(options);
    let query = db(this.tableName);

    if (options?.condition) {
      query = query.where(options.condition);
    }

    if (options?.conditionArr) {
      query = this.applyConditionArray(query, options.conditionArr);
    }

    if (options?.xcCondition) {
      query = this.applyXcCondition(query, options.xcCondition);
    }

    if (options?.orderBy) {
      for (const [column, direction] of Object.entries(options.orderBy)) {
        query = query.orderBy(column, direction);
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query as Promise<T[]>;
  }

  /**
   * List entities with caching
   */
  async list(listKey: string, options?: QueryOptions): Promise<T[]> {
    const cache = this.getCache();

    if (!options?.skipCache) {
      const cached = await cache.getList<T>(this.cacheScope, listKey);
      if (cached) return cached;
    }

    const dataList = await this.findMany(options);

    if (!options?.skipCache) {
      await cache.setList(this.cacheScope, listKey, dataList);
    }

    return dataList;
  }

  /**
   * Count entities
   */
  async count(where?: Record<string, unknown>, options?: RepositoryOptions): Promise<number> {
    const db = this.getDb(options);
    let query = db(this.tableName);

    if (where) {
      query = query.where(where);
    }

    const result = await query.count({ count: '*' }).first();
    return Number(result?.count || 0);
  }

  /**
   * Create a new entity
   */
  async create(data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>, options?: RepositoryOptions): Promise<string> {
    const db = this.getDb(options);
    const cache = this.getCache();
    const now = new Date();
    const id = generateId();

    const insertData = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    } as Record<string, unknown>;

    await db(this.tableName).insert(insertData);

    if (!options?.skipCache) {
      await cache.set(this.getCacheKey(id), insertData);
    }

    return id;
  }

  /**
   * Update an entity
   */
  async update(id: string, data: Partial<T>, options?: RepositoryOptions): Promise<void> {
    const db = this.getDb(options);
    const cache = this.getCache();

    const updateData = {
      ...data,
      updated_at: new Date(),
    } as Record<string, unknown>;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    await db(this.tableName).where('id', id).update(updateData);

    // Update cache
    if (!options?.skipCache) {
      const cached = await cache.get<T>(this.getCacheKey(id));
      if (cached) {
        await cache.set(this.getCacheKey(id), { ...cached, ...updateData });
      }
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: string, options?: RepositoryOptions): Promise<number> {
    const db = this.getDb(options);
    const cache = this.getCache();

    const result = await db(this.tableName).where('id', id).delete();

    if (!options?.skipCache) {
      await cache.del(this.getCacheKey(id));
    }

    return result;
  }

  /**
   * Check if entity exists
   */
  async exists(id: string, options?: RepositoryOptions): Promise<boolean> {
    const entity = await this.getById(id, options);
    return entity !== null;
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  /**
   * Invalidate list cache
   */
  async invalidateListCache(listKey: string): Promise<void> {
    const cache = this.getCache();
    await cache.invalidateList(this.cacheScope, listKey);
  }

  /**
   * Invalidate entity cache
   */
  async invalidateCache(id: string): Promise<void> {
    const cache = this.getCache();
    await cache.del(this.getCacheKey(id));
  }

  // ==========================================================================
  // Transaction Support
  // ==========================================================================

  /**
   * Execute operations within a transaction
   */
  async transaction<R>(fn: (trx: Knex.Transaction) => Promise<R>): Promise<R> {
    const db = getDb();
    return db.transaction(fn);
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  /**
   * Get database instance
   */
  protected getDb(options?: RepositoryOptions): Knex {
    return options?.knex || getDb();
  }

  /**
   * Get cache instance
   */
  protected getCache(): NocoCache {
    return NocoCache.getInstance();
  }

  /**
   * Get cache key for entity
   */
  protected getCacheKey(id: string): string {
    return `${this.cacheScope}:${id}`;
  }

  /**
   * Apply condition array to query
   */
  private applyConditionArray(
    query: Knex.QueryBuilder,
    conditionArr: Array<{ key: string; value: unknown; op?: string }>
  ): Knex.QueryBuilder {
    for (const cond of conditionArr) {
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
    return query;
  }

  /**
   * Apply extended condition (supports nested AND/OR)
   */
  private applyXcCondition(
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
// Helper Functions (for backward compatibility)
// ============================================================================

/**
 * Generate a new ID using ULID
 */
export function genId(): string {
  return generateId();
}

export default BaseRepository;
