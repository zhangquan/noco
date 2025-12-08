/**
 * Table - Helper functions for metadata table operations
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
// Helper Functions
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
// CRUD Operations
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
