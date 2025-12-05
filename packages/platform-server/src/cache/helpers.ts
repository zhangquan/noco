/**
 * Cache Helper Utilities
 * Provides consistent caching patterns across the application
 * @module cache/helpers
 */

import { NocoCache, type ICacheStore } from './index.js';
import { CacheScope } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Skip cache read */
  skipRead?: boolean;
  /** Skip cache write */
  skipWrite?: boolean;
  /** Force refresh from source */
  forceRefresh?: boolean;
}

export interface CacheKeyParts {
  scope: CacheScope;
  id?: string;
  subKey?: string;
  listKey?: string;
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Build a standardized cache key
 */
export function buildCacheKey(parts: CacheKeyParts): string {
  const segments: string[] = [parts.scope];
  
  if (parts.listKey) {
    segments.push('list', parts.listKey);
  } else if (parts.id) {
    segments.push(parts.id);
    if (parts.subKey) {
      segments.push(parts.subKey);
    }
  }
  
  return segments.join(':');
}

/**
 * Parse a cache key into its parts
 */
export function parseCacheKey(key: string): CacheKeyParts {
  const segments = key.split(':');
  const scope = segments[0] as CacheScope;
  
  if (segments[1] === 'list') {
    return { scope, listKey: segments.slice(2).join(':') };
  }
  
  return {
    scope,
    id: segments[1],
    subKey: segments.slice(2).join(':') || undefined,
  };
}

// ============================================================================
// Cache Patterns
// ============================================================================

/**
 * Cache-aside pattern: Try cache first, fallback to source
 */
export async function cacheAside<T>(
  key: string,
  fetchFn: () => Promise<T | null>,
  options: CacheOptions = {}
): Promise<T | null> {
  const cache = NocoCache.getInstance();
  
  // Try cache first
  if (!options.skipRead && !options.forceRefresh) {
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  }
  
  // Fetch from source
  const data = await fetchFn();
  
  // Cache the result
  if (data !== null && !options.skipWrite) {
    await cache.set(key, data, options.ttl);
  }
  
  return data;
}

/**
 * Cache-aside for lists
 */
export async function cacheAsideList<T>(
  scope: CacheScope,
  listKey: string,
  fetchFn: () => Promise<T[]>,
  options: CacheOptions = {}
): Promise<T[]> {
  const cache = NocoCache.getInstance();
  const key = buildCacheKey({ scope, listKey });
  
  // Try cache first
  if (!options.skipRead && !options.forceRefresh) {
    const cached = await cache.get<T[]>(key);
    if (cached !== null) {
      return cached;
    }
  }
  
  // Fetch from source
  const data = await fetchFn();
  
  // Cache the result
  if (!options.skipWrite) {
    await cache.set(key, data, options.ttl);
  }
  
  return data;
}

/**
 * Write-through pattern: Write to cache and source simultaneously
 */
export async function writeThrough<T>(
  key: string,
  data: T,
  writeFn: (data: T) => Promise<void>,
  options: CacheOptions = {}
): Promise<void> {
  const cache = NocoCache.getInstance();
  
  // Write to source first
  await writeFn(data);
  
  // Update cache
  if (!options.skipWrite) {
    await cache.set(key, data, options.ttl);
  }
}

/**
 * Write-behind pattern: Write to cache immediately, batch write to source
 * Note: This is a simplified version - production should use a proper queue
 */
export class WriteBehindCache<T> {
  private pending = new Map<string, { data: T; timestamp: number }>();
  private flushInterval: NodeJS.Timeout;
  private ttl: number;
  private writeFn: (items: Array<{ key: string; data: T }>) => Promise<void>;
  
  constructor(
    writeFn: (items: Array<{ key: string; data: T }>) => Promise<void>,
    options: { flushIntervalMs?: number; ttl?: number } = {}
  ) {
    this.writeFn = writeFn;
    this.ttl = options.ttl ?? 3600;
    this.flushInterval = setInterval(
      () => this.flush(),
      options.flushIntervalMs ?? 5000
    );
  }
  
  async set(key: string, data: T): Promise<void> {
    const cache = NocoCache.getInstance();
    await cache.set(key, data, this.ttl);
    this.pending.set(key, { data, timestamp: Date.now() });
  }
  
  async flush(): Promise<void> {
    if (this.pending.size === 0) return;
    
    const items = Array.from(this.pending.entries()).map(([key, { data }]) => ({
      key,
      data,
    }));
    
    this.pending.clear();
    
    try {
      await this.writeFn(items);
    } catch (error) {
      // Re-add failed items
      for (const { key, data } of items) {
        this.pending.set(key, { data, timestamp: Date.now() });
      }
      throw error;
    }
  }
  
  destroy(): void {
    clearInterval(this.flushInterval);
  }
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate a single cache entry
 */
export async function invalidateCache(
  scope: CacheScope,
  id: string,
  options?: { subKey?: string }
): Promise<void> {
  const cache = NocoCache.getInstance();
  const key = buildCacheKey({ scope, id, subKey: options?.subKey });
  await cache.del(key);
}

/**
 * Invalidate a list cache
 */
export async function invalidateListCache(
  scope: CacheScope,
  listKey: string
): Promise<void> {
  const cache = NocoCache.getInstance();
  const key = buildCacheKey({ scope, listKey });
  await cache.del(key);
}

/**
 * Invalidate all caches for a scope
 */
export async function invalidateScopeCache(scope: CacheScope): Promise<void> {
  const cache = NocoCache.getInstance();
  await cache.delByScope(scope);
}

/**
 * Invalidate multiple related caches
 */
export async function invalidateRelated(
  entries: Array<{ scope: CacheScope; id?: string; listKey?: string }>
): Promise<void> {
  const cache = NocoCache.getInstance();
  
  await Promise.all(
    entries.map((entry) => {
      const key = buildCacheKey(entry);
      return cache.del(key);
    })
  );
}

// ============================================================================
// Cache Warming
// ============================================================================

export interface WarmCacheOptions<T> {
  scope: CacheScope;
  fetchAll: () => Promise<Array<T & { id: string }>>;
  ttl?: number;
  batchSize?: number;
}

/**
 * Warm cache with pre-fetched data
 */
export async function warmCache<T>(options: WarmCacheOptions<T>): Promise<number> {
  const { scope, fetchAll, ttl, batchSize = 100 } = options;
  const cache = NocoCache.getInstance();
  
  const items = await fetchAll();
  
  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(
      batch.map((item) => {
        const key = buildCacheKey({ scope, id: item.id });
        return cache.set(key, item, ttl);
      })
    );
  }
  
  return items.length;
}

// ============================================================================
// Cache Statistics
// ============================================================================

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
}

class CacheStatsCollector {
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  
  recordHit(): void {
    this.stats.hits++;
  }
  
  recordMiss(): void {
    this.stats.misses++;
  }
  
  recordSet(): void {
    this.stats.sets++;
  }
  
  recordDelete(): void {
    this.stats.deletes++;
  }
  
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
  
  reset(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }
}

export const cacheStats = new CacheStatsCollector();

/**
 * Wrapped cache-aside that collects statistics
 */
export async function cacheAsideWithStats<T>(
  key: string,
  fetchFn: () => Promise<T | null>,
  options: CacheOptions = {}
): Promise<T | null> {
  const cache = NocoCache.getInstance();
  
  // Try cache first
  if (!options.skipRead && !options.forceRefresh) {
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      cacheStats.recordHit();
      return cached;
    }
    cacheStats.recordMiss();
  }
  
  // Fetch from source
  const data = await fetchFn();
  
  // Cache the result
  if (data !== null && !options.skipWrite) {
    await cache.set(key, data, options.ttl);
    cacheStats.recordSet();
  }
  
  return data;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  buildCacheKey,
  parseCacheKey,
  cacheAside,
  cacheAsideList,
  writeThrough,
  WriteBehindCache,
  invalidateCache,
  invalidateListCache,
  invalidateScopeCache,
  invalidateRelated,
  warmCache,
  cacheStats,
  cacheAsideWithStats,
};
