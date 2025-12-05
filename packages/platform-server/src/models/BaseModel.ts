/**
 * BaseModel - Helper functions for metadata models
 * @module models/BaseModel
 */

import { NocoCache } from '../cache/index.js';
import { getNcMeta } from '../lib/NcMetaIO.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { MetaGetOptions, NcMetaIO } from '../lib/NcMetaIO.js';

// ============================================================================
// Types
// ============================================================================

export interface BaseModelOptions {
  ncMeta?: NcMetaIO;
  skipCache?: boolean;
}

function getCache(): NocoCache {
  return NocoCache.getInstance();
}

// ============================================================================
// Helper Functions
// ============================================================================

export async function getById<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  options?: BaseModelOptions
): Promise<T | null> {
  const cache = getCache();
  const ncMeta = options?.ncMeta || getNcMeta();

  if (!options?.skipCache) {
    const cached = await cache.get<T>(`${cacheScope}:${id}`);
    if (cached) return cached;
  }

  const data = await ncMeta.metaGet2(null, null, metaTable, id);
  if (!data) return null;

  if (!options?.skipCache) {
    await cache.set(`${cacheScope}:${id}`, data);
  }

  return data as T;
}

export async function getByCondition<T extends object>(
  metaTable: MetaTable,
  condition: Record<string, unknown>,
  options?: BaseModelOptions
): Promise<T | null> {
  const ncMeta = options?.ncMeta || getNcMeta();
  const data = await ncMeta.metaGet2(null, null, metaTable, condition);
  return data as T | null;
}

export async function listRecords<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  listKey: string,
  listOptions?: MetaGetOptions,
  options?: BaseModelOptions
): Promise<T[]> {
  const cache = getCache();
  const ncMeta = options?.ncMeta || getNcMeta();

  if (!options?.skipCache) {
    const cached = await cache.getList<T>(cacheScope, listKey);
    if (cached) return cached;
  }

  const dataList = await ncMeta.metaList(null, null, metaTable, listOptions);

  if (!options?.skipCache) {
    await cache.setList(cacheScope, listKey, dataList);
  }

  return dataList as T[];
}

export async function insertRecord<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  data: Partial<T>,
  options?: BaseModelOptions
): Promise<string> {
  const ncMeta = options?.ncMeta || getNcMeta();
  const cache = getCache();

  const id = await ncMeta.metaInsert(null, null, metaTable, data as Record<string, unknown>);

  if (!options?.skipCache) {
    await cache.set(`${cacheScope}:${id}`, { ...data, id });
  }

  return id;
}

export async function updateRecord<T extends object>(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  data: Partial<T>,
  options?: BaseModelOptions
): Promise<void> {
  const ncMeta = options?.ncMeta || getNcMeta();
  const cache = getCache();

  await ncMeta.metaUpdate(null, null, metaTable, data as Record<string, unknown>, id);

  if (!options?.skipCache) {
    const cached = await cache.get<T>(`${cacheScope}:${id}`);
    if (cached) {
      await cache.set(`${cacheScope}:${id}`, { ...cached, ...data });
    }
  }
}

export async function deleteRecord(
  cacheScope: CacheScope,
  metaTable: MetaTable,
  id: string,
  options?: BaseModelOptions
): Promise<number> {
  const ncMeta = options?.ncMeta || getNcMeta();
  const cache = getCache();

  const result = await ncMeta.metaDelete(null, null, metaTable, id);

  if (!options?.skipCache) {
    await cache.del(`${cacheScope}:${id}`);
  }

  return result;
}

export async function invalidateListCache(
  cacheScope: CacheScope,
  parentId: string
): Promise<void> {
  const cache = getCache();
  await cache.invalidateList(cacheScope, parentId);
}
