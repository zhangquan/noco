/**
 * Request Validation Middleware
 * @module rest-api/middleware/validation
 */

import type { Request, Response, NextFunction } from 'express';
import type { ApiRequest, PartialApiRequest } from '../types';

/**
 * Validate request body
 *
 * @param type - Expected body type ('object' or 'array')
 * @param required - Whether body is required
 */
export function validateBody(type: 'object' | 'array', required = true): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { body } = req;

    // Check if body is required
    if (required && (body === undefined || body === null)) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
        message: 'Request body is required',
      },
    });
      return;
    }

    // Skip type check if body is not present and not required
    if (!required && (body === undefined || body === null)) {
      return next();
    }

    // Check type
    if (type === 'array') {
      if (!Array.isArray(body)) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
          message: 'Request body must be an array',
        },
      });
        return;
      }
      if (required && body.length === 0) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
          message: 'Request body array cannot be empty',
        },
      });
        return;
      }
    } else if (type === 'object') {
      if (typeof body !== 'object' || Array.isArray(body)) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
          message: 'Request body must be an object',
        },
      });
        return;
      }
    }

    next();
  };
}

/**
 * Validate row ID format (ULID)
 */
export function validateRowId(req: Request, res: Response, next: NextFunction): void {
  const { rowId } = req.params;

  if (!rowId) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Row ID is required',
      },
    });
    return;
  }

  // ULID format: 26 alphanumeric characters
  if (!/^[0-9A-Z]{26}$/i.test(rowId)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid row ID format',
        details: { rowId },
      },
    });
    return;
  }

  next();
}

/**
 * Validate column name exists
 */
export function validateColumn(req: Request, res: Response, next: NextFunction): void {
  const apiReq = req as PartialApiRequest;
  const { columnName } = req.params;
  const table = apiReq.context?.table;

  if (!columnName) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Column name is required',
      },
    });
    return;
  }

  if (table) {
    const column = table.columns?.find(
      (c: { id: string; title: string }) => c.id === columnName || c.title === columnName
    );
    if (!column) {
      res.status(404).json({
        error: {
          code: 'COLUMN_NOT_FOUND',
          message: `Column '${columnName}' not found in table '${table.title || table.id}'`,
        },
      });
      return;
    }
  }

  next();
}

/**
 * Validate export format
 */
export function validateExportFormat(req: Request, res: Response, next: NextFunction): void {
  const format = (req.params.format || req.query.format || 'csv') as string;

  if (!['csv', 'xlsx', 'excel'].includes(format.toLowerCase())) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: `Invalid export format: ${format}. Supported formats: csv, xlsx`,
      },
    });
    return;
  }

  next();
}

/**
 * Validate query parameters
 */
export function validateQuery(rules: {
  [key: string]: {
    type?: 'string' | 'number' | 'boolean';
    required?: boolean;
    min?: number;
    max?: number;
    enum?: string[];
  };
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [key, rule] of Object.entries(rules)) {
      const value = req.query[key] as string | undefined;

      // Check required
      if (rule.required && !value) {
        errors.push(`Query parameter '${key}' is required`);
        continue;
      }

      if (!value) continue;

      // Check type and constraints
      if (rule.type === 'number') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          errors.push(`Query parameter '${key}' must be a number`);
        } else {
          if (rule.min !== undefined && num < rule.min) {
            errors.push(`Query parameter '${key}' must be >= ${rule.min}`);
          }
          if (rule.max !== undefined && num > rule.max) {
            errors.push(`Query parameter '${key}' must be <= ${rule.max}`);
          }
        }
      }

      // Check enum
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`Query parameter '${key}' must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query parameters',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}
