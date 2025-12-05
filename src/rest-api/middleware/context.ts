/**
 * Context Injection Middleware
 * @module rest-api/middleware/context
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Knex } from 'knex';
import type { Table } from '../../types';
import type { ApiRequest, AuthUser, RequestContext, PartialApiRequest } from '../types';

/**
 * User extractor function type
 */
export type UserExtractor = (req: ApiRequest) => Promise<AuthUser | undefined>;

/**
 * Create database context middleware
 * Injects database instance and table definitions into request
 *
 * @param db - Knex database instance
 * @param tables - Table definitions
 */
export function createContextMiddleware(
  db: Knex,
  tables: Table[]
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as PartialApiRequest;
    const tableName = req.params.tableName;

    // Resolve table from route params
    const table = tableName
      ? tables.find(
          (t) => t.id === tableName || t.title === tableName || t.name === tableName
        )
      : undefined;

    // Build request context
    (apiReq as ApiRequest).context = {
      db,
      tables,
      table,
      tableId: table?.id,
      viewId: req.params.viewName || req.params.viewId,
      user: apiReq.user,
      cookie: {
        user: apiReq.user
          ? {
              id: apiReq.user.id,
              email: apiReq.user.email,
              display_name: apiReq.user.displayName,
            }
          : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    };

    next();
  };
}

/**
 * Create user context middleware
 * Extracts user from auth headers/tokens
 *
 * @param extractUser - Function to extract user from request
 */
export function createUserMiddleware(extractUser: UserExtractor): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as PartialApiRequest;
    try {
      const user = await extractUser(apiReq as ApiRequest);
      apiReq.user = user;

      // Update context if already exists
      if (apiReq.context) {
        apiReq.context.user = user;
        apiReq.context.cookie.user = user
          ? {
              id: user.id,
              email: user.email,
              display_name: user.displayName,
            }
          : undefined;
      }

      next();
    } catch {
      // Don't fail on auth errors, continue without user
      apiReq.user = undefined;
      next();
    }
  };
}

/**
 * Ensure table exists middleware
 * Validates that the requested table exists
 */
export function requireTable(req: Request, res: Response, next: NextFunction): void {
  const apiReq = req as PartialApiRequest;
  if (!apiReq.context?.table) {
    const tableName = req.params.tableName;
    res.status(404).json({
      error: {
        code: 'TABLE_NOT_FOUND',
        message: tableName
          ? `Table '${tableName}' not found`
          : 'Table name is required',
      },
    });
    return;
  }
  next();
}
