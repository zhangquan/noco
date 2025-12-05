/**
 * Enhanced Rate Limiting Middleware
 * Configurable per-route rate limiting with Redis support
 * @module middleware/rateLimit
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { type Options as RateLimitOptions } from 'express-rate-limit';
import { RateLimitError } from '../errors/index.js';
import type { ApiRequest } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  max: number;
  /** Message to return when rate limited */
  message?: string;
  /** Skip certain requests */
  skip?: (req: Request) => boolean;
  /** Key generator function */
  keyGenerator?: (req: Request) => string;
  /** Use user ID as key if authenticated */
  useUserId?: boolean;
  /** Skip successful requests from count */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests from count */
  skipFailedRequests?: boolean;
}

export interface RateLimitPreset {
  name: string;
  config: RateLimitConfig;
}

// ============================================================================
// Rate Limit Presets
// ============================================================================

export const RateLimitPresets = {
  // Strict rate limit for authentication endpoints
  auth: {
    name: 'auth',
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 requests per 15 minutes
      message: 'Too many authentication attempts, please try again later',
    },
  },

  // Password reset - very strict
  passwordReset: {
    name: 'passwordReset',
    config: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 requests per hour
      message: 'Too many password reset attempts, please try again later',
    },
  },

  // API general - moderate
  api: {
    name: 'api',
    config: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
      message: 'Too many requests, please slow down',
      useUserId: true,
    },
  },

  // API strict - for expensive operations
  apiStrict: {
    name: 'apiStrict',
    config: {
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 requests per minute
      message: 'Rate limit exceeded for this operation',
      useUserId: true,
    },
  },

  // Data API - for CRUD operations
  data: {
    name: 'data',
    config: {
      windowMs: 60 * 1000, // 1 minute
      max: 200, // 200 requests per minute
      message: 'Too many data requests, please slow down',
      useUserId: true,
    },
  },

  // Export/Import operations - very strict
  export: {
    name: 'export',
    config: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10, // 10 requests per hour
      message: 'Export rate limit exceeded, please try again later',
      useUserId: true,
    },
  },

  // Bulk operations
  bulk: {
    name: 'bulk',
    config: {
      windowMs: 60 * 1000, // 1 minute
      max: 5, // 5 requests per minute
      message: 'Bulk operation rate limit exceeded',
      useUserId: true,
    },
  },

  // Public API (unauthenticated)
  public: {
    name: 'public',
    config: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute
      message: 'Public API rate limit exceeded',
    },
  },

  // Development (very permissive)
  development: {
    name: 'development',
    config: {
      windowMs: 60 * 1000,
      max: 1000,
      message: 'Development rate limit exceeded',
    },
  },
} as const;

// ============================================================================
// Key Generators
// ============================================================================

/**
 * Generate key based on IP address
 */
function ipKeyGenerator(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Generate key based on user ID (for authenticated requests)
 */
function userKeyGenerator(req: Request): string {
  const user = (req as ApiRequest).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  return ipKeyGenerator(req);
}

/**
 * Generate key based on user ID + endpoint
 */
function userEndpointKeyGenerator(req: Request): string {
  const user = (req as ApiRequest).user;
  const baseKey = user?.id ? `user:${user.id}` : ipKeyGenerator(req);
  return `${baseKey}:${req.method}:${req.baseUrl}${req.path}`;
}

// ============================================================================
// Rate Limit Factory
// ============================================================================

/**
 * Create a rate limit middleware with custom configuration
 */
export function createRateLimit(config: RateLimitConfig): RequestHandler {
  const keyGen = config.keyGenerator || (config.useUserId ? userKeyGenerator : ipKeyGenerator);
  
  const options: Partial<RateLimitOptions> = {
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests,
    skipFailedRequests: config.skipFailedRequests,
    skip: config.skip as any,
    keyGenerator: keyGen as any,
    handler: ((req: Request, res: Response, _next: NextFunction, _options: any) => {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      const error = new RateLimitError(
        config.message || 'Too many requests, please try again later',
        retryAfter
      );
      
      res.status(429).json(error.toJSON());
    }) as any,
  };

  return rateLimit(options) as unknown as RequestHandler;
}

/**
 * Create rate limit from preset
 */
export function createRateLimitFromPreset(preset: keyof typeof RateLimitPresets): RequestHandler {
  const presetConfig = RateLimitPresets[preset];
  return createRateLimit(presetConfig.config);
}

// ============================================================================
// Dynamic Rate Limiting
// ============================================================================

interface DynamicRateLimitConfig {
  /** Default rate limit config */
  default: RateLimitConfig;
  /** Override config based on user role */
  roleOverrides?: Record<string, Partial<RateLimitConfig>>;
  /** Override config based on route */
  routeOverrides?: Record<string, Partial<RateLimitConfig>>;
}

/**
 * Create dynamic rate limit that adjusts based on user role or route
 */
export function createDynamicRateLimit(config: DynamicRateLimitConfig): RequestHandler {
  const rateLimiters = new Map<string, RequestHandler>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as ApiRequest).user;
    const route = `${req.method}:${req.baseUrl}${req.path}`;
    
    // Determine which config to use
    let effectiveConfig = { ...config.default };
    
    // Apply route overrides
    if (config.routeOverrides) {
      for (const [pattern, override] of Object.entries(config.routeOverrides)) {
        if (route.includes(pattern) || new RegExp(pattern).test(route)) {
          effectiveConfig = { ...effectiveConfig, ...override };
          break;
        }
      }
    }
    
    // Apply role overrides
    if (config.roleOverrides && user?.roles) {
      const roleConfig = config.roleOverrides[user.roles];
      if (roleConfig) {
        effectiveConfig = { ...effectiveConfig, ...roleConfig };
      }
    }
    
    // Create or reuse rate limiter
    const configKey = JSON.stringify(effectiveConfig);
    let limiter = rateLimiters.get(configKey);
    
    if (!limiter) {
      limiter = createRateLimit(effectiveConfig);
      rateLimiters.set(configKey, limiter);
    }
    
    limiter(req, res, next);
  };
}

// ============================================================================
// Sliding Window Rate Limiter (In-Memory)
// ============================================================================

interface SlidingWindowEntry {
  timestamps: number[];
}

class SlidingWindowRateLimiter {
  private store = new Map<string, SlidingWindowEntry>();
  private windowMs: number;
  private max: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
    
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }
    
    // Remove old timestamps
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
    
    if (entry.timestamps.length >= this.max) {
      return false;
    }
    
    entry.timestamps.push(now);
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    const entry = this.store.get(key);
    if (!entry) {
      return this.max;
    }
    
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);
    return Math.max(0, this.max - validTimestamps.length);
  }

  getResetTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry || entry.timestamps.length === 0) {
      return Date.now() + this.windowMs;
    }
    
    const oldestTimestamp = Math.min(...entry.timestamps);
    return oldestTimestamp + this.windowMs;
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

/**
 * Create sliding window rate limiter middleware
 */
export function createSlidingWindowRateLimit(config: RateLimitConfig): RequestHandler {
  const limiter = new SlidingWindowRateLimiter(config.windowMs, config.max);
  const keyGen = config.keyGenerator || (config.useUserId ? userKeyGenerator : ipKeyGenerator);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.skip?.(req)) {
      next();
      return;
    }

    const key = keyGen(req);
    
    if (limiter.isAllowed(key)) {
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', limiter.getRemainingRequests(key).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(limiter.getResetTime(key) / 1000).toString());
      next();
    } else {
      const retryAfter = Math.ceil((limiter.getResetTime(key) - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      const error = new RateLimitError(
        config.message || 'Too many requests, please try again later',
        retryAfter
      );
      
      res.status(429).json(error.toJSON());
    }
  };
}

// ============================================================================
// Skip Functions
// ============================================================================

/**
 * Skip rate limiting for certain paths
 */
export function skipPaths(...paths: string[]): (req: Request) => boolean {
  const pathSet = new Set(paths);
  return (req: Request) => pathSet.has(req.path);
}

/**
 * Skip rate limiting for certain methods
 */
export function skipMethods(...methods: string[]): (req: Request) => boolean {
  const methodSet = new Set(methods.map(m => m.toUpperCase()));
  return (req: Request) => methodSet.has(req.method);
}

/**
 * Skip rate limiting for authenticated users
 */
export function skipAuthenticated(): (req: Request) => boolean {
  return (req: Request) => !!(req as ApiRequest).user;
}

/**
 * Combine multiple skip functions
 */
export function combineSkip(...skipFns: Array<(req: Request) => boolean>): (req: Request) => boolean {
  return (req: Request) => skipFns.some(fn => fn(req));
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createRateLimit,
  createRateLimitFromPreset,
  createDynamicRateLimit,
  createSlidingWindowRateLimit,
  RateLimitPresets,
  skipPaths,
  skipMethods,
  skipAuthenticated,
  combineSkip,
};
