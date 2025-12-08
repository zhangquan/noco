/**
 * Cache Metrics Collector
 * 
 * Collects and reports cache performance metrics
 * including hit rate, latency, and operation counts.
 * 
 * @module cache/metrics
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Cache operation types
 */
export type CacheOperation = 'get' | 'set' | 'delete' | 'list_get' | 'list_set';

/**
 * Cache metrics snapshot
 */
export interface CacheMetrics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Total set operations */
  sets: number;
  /** Total delete operations */
  deletes: number;
  /** Average operation latency in milliseconds */
  avgLatencyMs: number;
  /** Peak latency in milliseconds */
  peakLatencyMs: number;
  /** Total operations */
  totalOperations: number;
}

/**
 * Per-scope metrics
 */
export interface ScopeMetrics {
  scope: string;
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// Metrics Collector
// ============================================================================

/**
 * Cache metrics collector singleton
 * 
 * @example
 * ```typescript
 * // Record operations
 * cacheMetrics.recordHit('user', 5);
 * cacheMetrics.recordMiss('user', 10);
 * 
 * // Get metrics
 * const metrics = cacheMetrics.getMetrics();
 * console.log(`Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
 * 
 * // Get per-scope metrics
 * const scopeMetrics = cacheMetrics.getScopeMetrics();
 * ```
 */
class CacheMetricsCollector {
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private totalLatencyMs = 0;
  private operationCount = 0;
  private peakLatencyMs = 0;
  
  // Per-scope tracking
  private scopeHits = new Map<string, number>();
  private scopeMisses = new Map<string, number>();

  /**
   * Record a cache hit
   */
  recordHit(scope?: string, latencyMs: number = 0): void {
    this.hits++;
    this.recordLatency(latencyMs);
    
    if (scope) {
      this.scopeHits.set(scope, (this.scopeHits.get(scope) || 0) + 1);
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(scope?: string, latencyMs: number = 0): void {
    this.misses++;
    this.recordLatency(latencyMs);
    
    if (scope) {
      this.scopeMisses.set(scope, (this.scopeMisses.get(scope) || 0) + 1);
    }
  }

  /**
   * Record a set operation
   */
  recordSet(): void {
    this.sets++;
  }

  /**
   * Record a delete operation
   */
  recordDelete(): void {
    this.deletes++;
  }

  /**
   * Record operation latency
   */
  private recordLatency(ms: number): void {
    this.totalLatencyMs += ms;
    this.operationCount++;
    if (ms > this.peakLatencyMs) {
      this.peakLatencyMs = ms;
    }
  }

  /**
   * Get overall metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      sets: this.sets,
      deletes: this.deletes,
      avgLatencyMs: this.operationCount > 0
        ? this.totalLatencyMs / this.operationCount
        : 0,
      peakLatencyMs: this.peakLatencyMs,
      totalOperations: this.operationCount,
    };
  }

  /**
   * Get per-scope metrics
   */
  getScopeMetrics(): ScopeMetrics[] {
    const scopes = new Set([
      ...this.scopeHits.keys(),
      ...this.scopeMisses.keys(),
    ]);

    return Array.from(scopes).map(scope => {
      const hits = this.scopeHits.get(scope) || 0;
      const misses = this.scopeMisses.get(scope) || 0;
      const total = hits + misses;
      
      return {
        scope,
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
      };
    });
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
    this.totalLatencyMs = 0;
    this.operationCount = 0;
    this.peakLatencyMs = 0;
    this.scopeHits.clear();
    this.scopeMisses.clear();
  }

  /**
   * Get a summary string
   */
  getSummary(): string {
    const m = this.getMetrics();
    return [
      `Cache Metrics:`,
      `  Hit Rate: ${(m.hitRate * 100).toFixed(1)}%`,
      `  Hits: ${m.hits}, Misses: ${m.misses}`,
      `  Sets: ${m.sets}, Deletes: ${m.deletes}`,
      `  Avg Latency: ${m.avgLatencyMs.toFixed(2)}ms`,
      `  Peak Latency: ${m.peakLatencyMs.toFixed(2)}ms`,
    ].join('\n');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global cache metrics collector instance
 */
export const cacheMetrics = new CacheMetricsCollector();

// ============================================================================
// Metric Decorators
// ============================================================================

/**
 * Wrap a cache get operation with metrics collection
 */
export async function withGetMetrics<T>(
  scope: string,
  operation: () => Promise<T | null>
): Promise<T | null> {
  const start = Date.now();
  const result = await operation();
  const latency = Date.now() - start;

  if (result !== null && result !== undefined) {
    cacheMetrics.recordHit(scope, latency);
  } else {
    cacheMetrics.recordMiss(scope, latency);
  }

  return result;
}

/**
 * Wrap a cache set operation with metrics collection
 */
export async function withSetMetrics<T>(
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation();
  cacheMetrics.recordSet();
  return result;
}

/**
 * Wrap a cache delete operation with metrics collection
 */
export async function withDeleteMetrics<T>(
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation();
  cacheMetrics.recordDelete();
  return result;
}
