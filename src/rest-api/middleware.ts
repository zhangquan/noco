/**
 * REST API Middleware
 * @module rest-api/middleware
 */

import type { Response, NextFunction, RequestHandler } from 'express';
import type { Knex } from 'knex';
import type { Table } from '../types';
import { ModelError, ErrorCode } from '../core/NcError';
import type {
  AgentRequest,
  AclConfig,
  RequestUser,
} from './types';
import { sendError } from './helpers';

/**
 * Async handler type for REST API routes
 */
export type AsyncHandler = (
  req: AgentRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;

// ============================================================================
// Error Handling Middleware
// ============================================================================

/**
 * Async handler wrapper with error catching
 * Wraps async route handlers to catch and forward errors
 */
export function asyncHandler(fn: AsyncHandler): (req: AgentRequest, res: Response, next: NextFunction) => void {
  return (req: AgentRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      if (error instanceof ModelError) {
        sendError(res, error);
      } else {
        console.error('Unhandled route error:', error);
        sendError(res, new ModelError(
          (error as Error).message || 'Internal server error',
          ErrorCode.INTERNAL_SERVER_ERROR
        ));
      }
    });
  };
}

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  error: Error,
  req: AgentRequest,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ModelError) {
    sendError(res, error);
  } else {
    sendError(res, new ModelError(
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_SERVER_ERROR
    ));
  }
}

// ============================================================================
// ACL (Access Control) Middleware
// ============================================================================

/**
 * ACL middleware wrapper
 * Checks user permissions before allowing access to route
 * 
 * @example
 * ```typescript
 * router.get('/data', ncMetaAclMw(listHandler, 'dataList', { action: 'read' }));
 * router.post('/data', ncMetaAclMw(createHandler, 'dataCreate', { action: 'create' }));
 * ```
 */
export function ncMetaAclMw(
  handler: (req: AgentRequest, res: Response, next: NextFunction) => void,
  handlerName: string,
  aclConfig?: AclConfig
): (req: AgentRequest, res: Response, next: NextFunction) => void {
  return (req: AgentRequest, res: Response, next: NextFunction): void => {
    const run = async (): Promise<void> => {
    // Skip ACL check if no config provided
    if (!aclConfig) {
      return handler(req, res, next);
    }

    const { action, check } = aclConfig;
    const user = req.user;

      // Check if user is authenticated (for non-public routes)
      if (!user && action !== 'read') {
        throw new ModelError('Authentication required', ErrorCode.UNAUTHORIZED);
      }

      // Custom permission check
      if (check && user) {
        const tableName = req.params.tableName;
        const table = req.tables?.find(
          (t) => t.id === tableName || t.title === tableName
        );

        if (table) {
          const hasPermission = await check(user, table);
          if (!hasPermission) {
            throw new ModelError(
              `Permission denied for action '${action}' on table '${table.title}'`,
              ErrorCode.FORBIDDEN
            );
          }
        }
      }
    };

    run()
      .then(() => handler(req, res, next))
      .catch((error: unknown) => {
        if (error instanceof ModelError) {
          sendError(res, error);
        } else {
          sendError(res, new ModelError(
            (error as Error).message || 'Internal server error',
            ErrorCode.INTERNAL_SERVER_ERROR
          ));
        }
      });
  };
}

// ============================================================================
// Database Context Middleware
// ============================================================================

/**
 * Database context middleware factory
 * Injects database and tables into request
 * 
 * @example
 * ```typescript
 * const dbMiddleware = createDbContextMiddleware(knex, tables);
 * router.use(dbMiddleware);
 * ```
 */
export function createDbContextMiddleware(
  db: Knex,
  tables: Table[]
): RequestHandler {
  return (req: AgentRequest, res: Response, next: NextFunction) => {
    req.db = db;
    req.tables = tables;
    next();
  };
}

/**
 * User context middleware factory
 * Extracts user from auth headers/tokens
 * This is a placeholder - actual implementation depends on auth strategy
 * 
 * @example
 * ```typescript
 * const userMiddleware = createUserContextMiddleware(async (req) => {
 *   const token = req.headers.authorization?.replace('Bearer ', '');
 *   return await verifyToken(token);
 * });
 * router.use(userMiddleware);
 * ```
 */
export function createUserContextMiddleware(
  extractUser: (req: AgentRequest) => Promise<RequestUser | undefined>
): RequestHandler {
  return async (req: AgentRequest, res: Response, next: NextFunction) => {
    try {
      req.user = await extractUser(req);
      req.context = {
        user: req.user ? {
          id: req.user.id,
          email: req.user.email,
          display_name: req.user.display_name,
        } : undefined,
        ip: req.ip,
        user_agent: req.get('user-agent'),
      };
      next();
    } catch (error) {
      // Don't fail on auth errors, just continue without user
      req.user = undefined;
      req.context = {
        ip: req.ip,
        user_agent: req.get('user-agent'),
      };
      next();
    }
  };
}

// ============================================================================
// API Metrics Middleware
// ============================================================================

/**
 * API metrics tracking middleware
 * Records API call metrics for monitoring
 */
export function apiMetrics(
  req: AgentRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.route?.path || req.path;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log metrics (can be replaced with actual metrics system)
    console.log(`[API] ${method} ${path} - ${statusCode} - ${duration}ms`);
  });

  next();
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

/**
 * Simple rate limiting middleware
 * 
 * @example
 * ```typescript
 * // Limit to 100 requests per minute
 * router.use(rateLimiter({ windowMs: 60000, maxRequests: 100 }));
 * ```
 */
export function rateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: AgentRequest) => string;
}): RequestHandler {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  return (req: AgentRequest, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Clean up expired entries
    if (rateLimitStore[key] && rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }

    // Initialize or increment
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
    } else {
      rateLimitStore[key].count++;
    }

    // Check limit
    if (rateLimitStore[key].count > maxRequests) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          statusCode: 429,
        },
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimitStore[key].count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitStore[key].resetTime / 1000));

    next();
  };
}

// ============================================================================
// Request Validation Middleware
// ============================================================================

/**
 * Request body validation middleware
 * Validates that request body is an object or array as required
 */
export function validateBody(options: {
  required?: boolean;
  type?: 'object' | 'array';
}): (req: AgentRequest, res: Response, next: NextFunction) => void {
  const { required = false, type } = options;

  return (req: AgentRequest, res: Response, next: NextFunction): void => {
    if (required && !req.body) {
      sendError(res, new ModelError('Request body is required', ErrorCode.BAD_REQUEST));
      return;
    }

    if (type === 'object' && req.body && typeof req.body !== 'object') {
      sendError(res, new ModelError('Request body must be an object', ErrorCode.BAD_REQUEST));
      return;
    }

    if (type === 'array' && req.body && !Array.isArray(req.body)) {
      sendError(res, new ModelError('Request body must be an array', ErrorCode.BAD_REQUEST));
      return;
    }

    next();
  };
}

/**
 * Table existence validation middleware
 * Validates that the table exists before proceeding
 */
export function validateTable(req: AgentRequest, res: Response, next: NextFunction): void {
  const tableName = req.params.tableName;
  
  if (!tableName) {
    sendError(res, new ModelError('Table name is required', ErrorCode.BAD_REQUEST));
    return;
  }

  if (!req.tables || req.tables.length === 0) {
    sendError(res, new ModelError('Tables not configured', ErrorCode.INTERNAL_SERVER_ERROR));
    return;
  }

  const table = req.tables.find(
    (t) => t.id === tableName || t.title === tableName || t.name === tableName
  );

  if (!table) {
    sendError(res, new ModelError(`Table '${tableName}' not found`, ErrorCode.NOT_FOUND));
    return;
  }

  next();
}

// ============================================================================
// CORS Middleware
// ============================================================================

/**
 * CORS middleware for API routes
 */
export function corsMiddleware(options: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
}): RequestHandler {
  const {
    origins = ['*'],
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Requested-With'],
  } = options;

  return (req: AgentRequest, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    
    if (origins.includes('*') || (origin && origins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
