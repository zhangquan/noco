/**
 * Rate Limiting Middleware
 * @module rest-api/middleware/rateLimit
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getConfig } from '../config';

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limit store
 */
const store = new Map<string, RateLimitEntry>();

/**
 * Clean expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Default key generator (by IP)
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.get('x-forwarded-for') || 'unknown';
}

/**
 * Rate limiting middleware options
 */
export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs?: number;
  /** Maximum requests per window */
  max?: number;
  /** Key generator function */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
}

/**
 * Create rate limiting middleware
 *
 * @param options - Rate limit options
 */
export function rateLimit(options: RateLimitOptions = {}): RequestHandler {
  const config = getConfig();

  const {
    windowMs = config.rateLimitWindow,
    max = config.rateLimitMax,
    keyGenerator = defaultKeyGenerator,
    skip,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if rate limiting is disabled
    if (!config.enableRateLimit) {
      return next();
    }

    // Skip if skip function returns true
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create entry
    let entry = store.get(key);
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    }

    // Increment count
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    // Check limit
    if (entry.count > max) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            retryAfter: Math.ceil((entry.resetTime - now) / 1000),
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Strict rate limit for sensitive operations
 */
export function strictRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60000,
    max: 10,
  });
}
