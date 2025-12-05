/**
 * Health Check Middleware
 * Comprehensive health checks for all system components
 * @module middleware/health
 */

import type { Request, Response, NextFunction, Router } from 'express';
import { Router as ExpressRouter } from 'express';
import type { Knex } from 'knex';
import { NocoCache } from '../cache/index.js';

// ============================================================================
// Types
// ============================================================================

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface ComponentHealth {
  status: HealthStatus;
  name: string;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  components: ComponentHealth[];
  checks?: {
    database?: ComponentHealth;
    cache?: ComponentHealth;
    memory?: ComponentHealth;
    disk?: ComponentHealth;
  };
}

export interface HealthCheckConfig {
  version?: string;
  includeDiskCheck?: boolean;
  timeoutMs?: number;
}

// ============================================================================
// Health Check Functions
// ============================================================================

const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(db: Knex, timeoutMs = 5000): Promise<ComponentHealth> {
  const start = Date.now();
  
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database check timeout')), timeoutMs);
    });

    const checkPromise = db.raw('SELECT 1 as result');
    await Promise.race([checkPromise, timeoutPromise]);

    const latencyMs = Date.now() - start;

    return {
      status: latencyMs > 1000 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
      name: 'database',
      latencyMs,
      message: latencyMs > 1000 ? 'High latency detected' : 'Connected',
      details: {
        client: db.client.config.client,
      },
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      name: 'database',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check cache connectivity
 */
async function checkCache(timeoutMs = 3000): Promise<ComponentHealth> {
  const start = Date.now();
  
  try {
    const cache = NocoCache.getInstance();
    const testKey = '__health_check__';
    const testValue = Date.now().toString();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cache check timeout')), timeoutMs);
    });

    const checkPromise = async () => {
      await cache.set(testKey, testValue, 10);
      const result = await cache.get<string>(testKey);
      await cache.del(testKey);
      return result === testValue;
    };

    const isValid = await Promise.race([checkPromise(), timeoutPromise]);
    const latencyMs = Date.now() - start;

    if (!isValid) {
      return {
        status: HealthStatus.DEGRADED,
        name: 'cache',
        latencyMs,
        message: 'Cache read/write validation failed',
      };
    }

    return {
      status: latencyMs > 500 ? HealthStatus.DEGRADED : HealthStatus.HEALTHY,
      name: 'cache',
      latencyMs,
      message: latencyMs > 500 ? 'High latency detected' : 'Connected',
      details: {
        type: cache.isRedis() ? 'redis' : 'memory',
      },
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      name: 'cache',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Cache check failed',
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): ComponentHealth {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);

  let status = HealthStatus.HEALTHY;
  let message = 'Memory usage normal';

  if (heapPercentage > 90) {
    status = HealthStatus.UNHEALTHY;
    message = 'Critical memory usage';
  } else if (heapPercentage > 75) {
    status = HealthStatus.DEGRADED;
    message = 'High memory usage';
  }

  return {
    status,
    name: 'memory',
    message,
    details: {
      heapUsedMB,
      heapTotalMB,
      heapPercentage,
      rssMB,
      externalMB: Math.round(memUsage.external / 1024 / 1024),
    },
  };
}

/**
 * Check event loop lag
 */
async function checkEventLoop(): Promise<ComponentHealth> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      const lagMs = Date.now() - start;
      
      let status = HealthStatus.HEALTHY;
      let message = 'Event loop responsive';

      if (lagMs > 100) {
        status = HealthStatus.UNHEALTHY;
        message = 'Event loop blocked';
      } else if (lagMs > 20) {
        status = HealthStatus.DEGRADED;
        message = 'Event loop lag detected';
      }

      resolve({
        status,
        name: 'eventLoop',
        latencyMs: lagMs,
        message,
      });
    });
  });
}

// ============================================================================
// Main Health Check Function
// ============================================================================

export async function performHealthCheck(
  db?: Knex,
  config: HealthCheckConfig = {}
): Promise<HealthCheckResult> {
  const { version = '0.98.3', timeoutMs = 5000 } = config;
  const components: ComponentHealth[] = [];

  // Run health checks in parallel
  const checks = await Promise.allSettled([
    db ? checkDatabase(db, timeoutMs) : Promise.resolve(null),
    checkCache(timeoutMs),
    Promise.resolve(checkMemory()),
    checkEventLoop(),
  ]);

  // Process results
  const [dbResult, cacheResult, memoryResult, eventLoopResult] = checks;

  if (dbResult.status === 'fulfilled' && dbResult.value) {
    components.push(dbResult.value);
  }

  if (cacheResult.status === 'fulfilled') {
    components.push(cacheResult.value);
  }

  if (memoryResult.status === 'fulfilled') {
    components.push(memoryResult.value);
  }

  if (eventLoopResult.status === 'fulfilled') {
    components.push(eventLoopResult.value);
  }

  // Determine overall status
  let overallStatus = HealthStatus.HEALTHY;
  
  if (components.some(c => c.status === HealthStatus.UNHEALTHY)) {
    overallStatus = HealthStatus.UNHEALTHY;
  } else if (components.some(c => c.status === HealthStatus.DEGRADED)) {
    overallStatus = HealthStatus.DEGRADED;
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    components,
    checks: {
      database: components.find(c => c.name === 'database'),
      cache: components.find(c => c.name === 'cache'),
      memory: components.find(c => c.name === 'memory'),
    },
  };
}

// ============================================================================
// Health Check Router
// ============================================================================

export function createHealthRouter(
  getDb?: () => Knex | null,
  config: HealthCheckConfig = {}
): Router {
  const router = ExpressRouter();

  // Simple liveness probe
  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe (basic)
  router.get('/ready', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb?.();
      
      if (db) {
        await db.raw('SELECT 1');
      }

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  });

  // Full health check
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb?.() || undefined;
      const result = await performHealthCheck(db, config);

      const statusCode = result.status === HealthStatus.UNHEALTHY ? 503 :
                        result.status === HealthStatus.DEGRADED ? 200 : 200;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  });

  // Detailed health check (for monitoring)
  router.get('/detailed', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb?.() || undefined;
      const result = await performHealthCheck(db, config);

      // Add additional metrics
      const detailed = {
        ...result,
        process: {
          pid: process.pid,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpuUsage: process.cpuUsage(),
        },
        env: process.env.NODE_ENV || 'development',
      };

      const statusCode = result.status === HealthStatus.UNHEALTHY ? 503 : 200;
      res.status(statusCode).json(detailed);
    } catch (error) {
      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  });

  return router;
}

// ============================================================================
// Simple Health Check Middleware
// ============================================================================

export function simpleHealthCheck() {
  return (req: Request, res: Response): void => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  };
}

export default {
  performHealthCheck,
  createHealthRouter,
  simpleHealthCheck,
  HealthStatus,
};
