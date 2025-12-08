/**
 * Base Service Class
 * Provides standardized CRUD operations and business logic patterns
 * @module services/BaseService
 */

import type { Knex } from 'knex';
import { getDb, generateId } from '../db/index.js';
import { NocoCache } from '../cache/index.js';
import { NotFoundError, DatabaseError, Errors } from '../errors/index.js';
import { CacheScope, MetaTable } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Base entity interface - all entities should have these fields
 */
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Service operation options
 */
export interface ServiceOptions {
  /** Custom Knex instance (for transactions) */
  knex?: Knex;
  /** Skip cache operations */
  skipCache?: boolean;
}

/**
 * List query options
 */
export interface ListOptions extends ServiceOptions {
  /** Filter conditions */
  where?: Record<string, unknown>;
  /** Order by columns */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Limit results */
  limit?: number;
  /** Offset results */
  offset?: number;
}

/**
 * Paginated list result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Base Service Class
// ============================================================================

/**
 * Abstract base service providing common CRUD operations
 * 
 * @example
 * ```typescript
 * class UserService extends BaseService<User> {
 *   protected tableName = MetaTable.USERS;
 *   protected cacheScope = CacheScope.USER;
 *   protected entityName = 'User';
 * 
 *   async getByEmail(email: string, options?: ServiceOptions): Promise<User | null> {
 *     return this.findOne({ email: email.toLowerCase() }, options);
 *   }
 * }
 * ```
 */
export abstract class BaseService<T extends BaseEntity> {
  /** Database table name */
  protected abstract tableName: MetaTable;
  /** Cache scope for this entity */
  protected abstract cacheScope: CacheScope;
  /** Human-readable entity name for error messages */
  protected abstract entityName: string;

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  /**
   * Get entity by ID
   */
  async getById(id: string, options?: ServiceOptions): Promise<T | null> {
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
   * Get entity by ID, throw if not found
   */
  async getByIdOrFail(id: string, options?: ServiceOptions): Promise<T> {
    const entity = await this.getById(id, options);
    if (!entity) {
      throw new NotFoundError(this.entityName, id);
    }
    return entity;
  }

  /**
   * Find one entity by conditions
   */
  async findOne(where: Record<string, unknown>, options?: ServiceOptions): Promise<T | null> {
    const db = this.getDb(options);
    const data = await db(this.tableName).where(where).first();
    return (data as T) || null;
  }

  /**
   * Find all entities matching conditions
   */
  async findMany(options?: ListOptions): Promise<T[]> {
    const db = this.getDb(options);
    let query = db(this.tableName);

    if (options?.where) {
      query = query.where(options.where);
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
   * Get paginated list of entities
   */
  async list(
    page: number = 1,
    pageSize: number = 25,
    options?: Omit<ListOptions, 'limit' | 'offset'>
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const [data, total] = await Promise.all([
      this.findMany({ ...options, limit, offset }),
      this.count(options?.where, options),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Count entities
   */
  async count(where?: Record<string, unknown>, options?: ServiceOptions): Promise<number> {
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
  async create(data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>, options?: ServiceOptions): Promise<T> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    const insertData = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    } as Record<string, unknown>;

    await db(this.tableName).insert(insertData);

    const created = await this.getById(id, { ...options, skipCache: true });
    if (!created) {
      throw new DatabaseError(`Failed to create ${this.entityName}`);
    }

    // Update cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), created);
      await this.invalidateListCache();
    }

    return created;
  }

  /**
   * Update an entity
   */
  async update(id: string, data: Partial<T>, options?: ServiceOptions): Promise<T> {
    const db = this.getDb(options);

    const updateData = {
      ...data,
      updated_at: new Date(),
    } as Record<string, unknown>;

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;

    const affected = await db(this.tableName).where('id', id).update(updateData);

    if (affected === 0) {
      throw new NotFoundError(this.entityName, id);
    }

    const updated = await this.getById(id, { ...options, skipCache: true });
    if (!updated) {
      throw new NotFoundError(this.entityName, id);
    }

    // Update cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), updated);
      await this.invalidateListCache();
    }

    return updated;
  }

  /**
   * Delete an entity
   */
  async delete(id: string, options?: ServiceOptions): Promise<boolean> {
    const db = this.getDb(options);
    const affected = await db(this.tableName).where('id', id).delete();

    if (affected === 0) {
      return false;
    }

    // Invalidate cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.del(this.getCacheKey(id));
      await this.invalidateListCache();
    }

    return true;
  }

  /**
   * Soft delete an entity (sets deleted = true)
   */
  async softDelete(id: string, options?: ServiceOptions): Promise<boolean> {
    try {
      await this.update(id, { deleted: true } as unknown as Partial<T>, options);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string, options?: ServiceOptions): Promise<boolean> {
    const entity = await this.getById(id, options);
    return entity !== null;
  }

  // ============================================================================
  // Transaction Support
  // ============================================================================

  /**
   * Execute operations within a transaction
   */
  async transaction<R>(fn: (trx: Knex.Transaction) => Promise<R>): Promise<R> {
    const db = getDb();
    return db.transaction(fn);
  }

  // ============================================================================
  // Protected Helpers
  // ============================================================================

  /**
   * Get database instance
   */
  protected getDb(options?: ServiceOptions): Knex {
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
   * Get list cache key
   */
  protected getListCacheKey(suffix: string = 'all'): string {
    return `${this.cacheScope}:list:${suffix}`;
  }

  /**
   * Invalidate list cache
   */
  protected async invalidateListCache(suffix?: string): Promise<void> {
    const cache = this.getCache();
    if (suffix) {
      await cache.del(this.getListCacheKey(suffix));
    } else {
      await cache.invalidateList(this.cacheScope, 'all');
    }
  }

  /**
   * Execute a query with automatic error handling
   */
  protected async executeQuery<R>(
    queryFn: (db: Knex) => Promise<R>,
    options?: ServiceOptions
  ): Promise<R> {
    try {
      const db = this.getDb(options);
      return await queryFn(db);
    } catch (error) {
      if (error instanceof Error) {
        throw new DatabaseError(error.message, { cause: error });
      }
      throw error;
    }
  }
}

export default BaseService;
