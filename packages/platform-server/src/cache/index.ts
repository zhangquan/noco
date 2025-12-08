/**
 * NocoCache - Redis-based caching layer
 * @module cache
 */

import Redis, { type RedisOptions } from 'ioredis';
import { CacheScope } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  /** Redis connection URL or options */
  redis?: string | RedisOptions;
  /** Use in-memory cache instead of Redis */
  useMemory?: boolean;
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Cache key prefix */
  prefix?: string;
}

export interface ICacheStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Cache Store
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

class MemoryCacheStore implements ICacheStore {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const result: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) result.push(key);
    }
    return result;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// ============================================================================
// Redis Cache Store
// ============================================================================

class RedisCacheStore implements ICacheStore {
  private client: Redis;
  private prefix: string;
  private defaultTTL: number;

  constructor(client: Redis, prefix: string = 'nc:', defaultTTL: number = 3600) {
    this.client = client;
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const data = await this.client.get(this.prefixKey(key));
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    const expiry = ttl ?? this.defaultTTL;
    if (expiry > 0) {
      await this.client.setex(this.prefixKey(key), expiry, data);
    } else {
      await this.client.set(this.prefixKey(key), data);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.prefixKey(key));
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(this.prefixKey(pattern));
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.prefixKey(key));
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = await this.client.keys(this.prefixKey(pattern));
    return keys.map(k => k.slice(this.prefix.length));
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}

// ============================================================================
// NocoCache Singleton
// ============================================================================

class NocoCache {
  private static instance: NocoCache | null = null;
  private store: ICacheStore;
  private memoryStore: MemoryCacheStore | null = null;
  private redisClient: Redis | null = null;
  private defaultTTL: number;

  private constructor(config: CacheConfig = {}) {
    this.defaultTTL = config.defaultTTL ?? 3600;

    if (config.useMemory || !config.redis) {
      this.memoryStore = new MemoryCacheStore();
      this.store = this.memoryStore;
    } else {
      if (typeof config.redis === 'string') {
        this.redisClient = new Redis(config.redis);
      } else {
        this.redisClient = new Redis(config.redis);
      }
      this.store = new RedisCacheStore(this.redisClient, config.prefix ?? 'nc:', this.defaultTTL);
    }
  }

  static init(config?: CacheConfig): NocoCache {
    if (!NocoCache.instance) {
      NocoCache.instance = new NocoCache(config);
    }
    return NocoCache.instance;
  }

  static getInstance(): NocoCache {
    if (!NocoCache.instance) {
      NocoCache.instance = new NocoCache({ useMemory: true });
    }
    return NocoCache.instance;
  }

  static buildKey(scope: CacheScope, ...parts: string[]): string {
    return `${scope}:${parts.join(':')}`;
  }

  // Cache Operations
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.store.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    return this.store.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.store.del(key);
  }

  async delByScope(scope: CacheScope, pattern?: string): Promise<void> {
    const fullPattern = pattern ? `${scope}:${pattern}` : `${scope}:*`;
    return this.store.delByPattern(fullPattern);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.exists(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.store.keys(pattern);
  }

  async clear(): Promise<void> {
    return this.store.clear();
  }

  // List Operations
  async getList<T = unknown>(scope: CacheScope, parentId: string): Promise<T[] | null> {
    return this.get<T[]>(`${scope}:list:${parentId}`);
  }

  async setList<T = unknown>(scope: CacheScope, parentId: string, list: T[], ttl?: number): Promise<void> {
    return this.store.set(`${scope}:list:${parentId}`, list, ttl);
  }

  async invalidateList(scope: CacheScope, parentId: string): Promise<void> {
    return this.del(`${scope}:list:${parentId}`);
  }

  // Connection Management
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
    if (this.memoryStore) {
      this.memoryStore.destroy();
      this.memoryStore = null;
    }
    NocoCache.instance = null;
  }

  isRedis(): boolean {
    return this.redisClient !== null;
  }
}

export const getCache = NocoCache.getInstance;
export const initCache = NocoCache.init;

export { NocoCache, MemoryCacheStore, RedisCacheStore };

// Cache helpers
export {
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
  type CacheOptions,
  type CacheKeyParts as LegacyCacheKeyParts,
  type WarmCacheOptions,
  type CacheStats,
} from './helpers.js';

// Optimized cache key builders
export {
  CacheKeys,
  cacheKey,
  parseCacheKey as parseKey,
  isValidCacheKey,
  type CacheKeyParts,
} from './keys.js';

// Cache metrics
export {
  cacheMetrics,
  withGetMetrics,
  withSetMetrics,
  withDeleteMetrics,
  type CacheMetrics,
  type ScopeMetrics,
  type CacheOperation,
} from './metrics.js';

export default NocoCache;
