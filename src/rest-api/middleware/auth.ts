/**
 * Authentication & Authorization Middleware
 * @module rest-api/middleware/auth
 */

import type { Request, Response, NextFunction } from 'express';
import type { Table } from '../../types';
import type { ApiRequest, AuthUser, PartialApiRequest } from '../types';
import { getConfig } from '../config';

/**
 * Permission action types
 */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'bulkCreate'
  | 'bulkUpdate'
  | 'bulkDelete'
  | 'link'
  | 'unlink'
  | 'export';

/**
 * Permission checker function type
 */
export type PermissionChecker = (
  user: AuthUser,
  action: Action,
  table?: Table
) => boolean | Promise<boolean>;

/**
 * Default permission checker (allows all for authenticated users)
 */
const defaultPermissionChecker: PermissionChecker = (user) => !!user;

/**
 * Global permission checker
 */
let permissionChecker: PermissionChecker = defaultPermissionChecker;

/**
 * Set custom permission checker
 */
export function setPermissionChecker(checker: PermissionChecker): void {
  permissionChecker = checker;
}

/**
 * Check if user has permission for action
 */
async function checkPermission(
  user: AuthUser | undefined,
  action: Action,
  table?: Table
): Promise<boolean> {
  if (!user) return false;
  return permissionChecker(user, action, table);
}

/**
 * Authorization middleware factory
 * Creates middleware that checks user permissions for a specific action
 *
 * @param action - Required action permission
 */
export function authorize(action: Action) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as PartialApiRequest;
    const config = getConfig();
    const user = apiReq.user;
    const table = apiReq.context?.table;

    // Allow anonymous read if configured
    if (action === 'read' && config.allowAnonymousRead && !user) {
      return next();
    }

    // Require authentication for other actions
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check permission
    const hasPermission = await checkPermission(user, action, table);
    if (!hasPermission) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied for action '${action}'`,
          details: table ? { table: table.title || table.id } : undefined,
        },
      });
    }

    next();
  };
}

/**
 * Require authentication middleware
 * Simpler version that just checks if user is logged in
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiReq = req as PartialApiRequest;
  if (!apiReq.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }
  next();
}

/**
 * Optional auth middleware
 * Allows request to continue even without authentication
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  // Just continue - user may or may not be present
  next();
}
