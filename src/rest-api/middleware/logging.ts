/**
 * Logging Middleware
 * @module rest-api/middleware/logging
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PartialApiRequest } from '../types';
import { getConfig } from '../config';

/**
 * Request logging middleware
 * Logs incoming requests and response times
 */
export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getConfig();

    if (!config.enableLogging) {
      return next();
    }

    const apiReq = req as PartialApiRequest;
    const startTime = Date.now();
    const { method, path, query } = req;

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      const logData = {
        method,
        path,
        status: statusCode,
        duration: `${duration}ms`,
        query: Object.keys(query).length > 0 ? query : undefined,
        user: apiReq.user?.id,
      };

      // Log based on status code
      if (statusCode >= 500) {
        console.error('[API]', logData);
      } else if (statusCode >= 400) {
        console.warn('[API]', logData);
      } else if (config.logLevel === 'debug') {
        console.log('[API]', logData);
      }
    });

    next();
  };
}

/**
 * Simple request logger
 * Minimal logging for each request
 */
export function simpleLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
}
