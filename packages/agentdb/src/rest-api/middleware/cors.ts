/**
 * CORS Middleware
 * @module rest-api/middleware/cors
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getConfig } from '../config';

/**
 * CORS middleware options
 */
export interface CorsOptions {
  /** Allowed origins */
  origins?: string[];
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  headers?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Preflight cache duration in seconds */
  maxAge?: number;
}

/**
 * Create CORS middleware
 *
 * @param options - CORS options
 */
export function cors(options: CorsOptions = {}): RequestHandler {
  const config = getConfig();

  const {
    origins = config.corsOrigins,
    methods = config.corsMethods,
    headers = config.corsHeaders,
    exposedHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials = false,
    maxAge = 86400,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');

    // Check if origin is allowed
    const isAllowed =
      origins.includes('*') || (origin && origins.includes(origin));

    if (isAllowed) {
      // Set origin (use actual origin instead of * if credentials are enabled)
      res.setHeader(
        'Access-Control-Allow-Origin',
        credentials && origin ? origin : origins.includes('*') ? '*' : origin || '*'
      );

      // Set other CORS headers
      res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', headers.join(', '));

      if (exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
      }

      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.setHeader('Access-Control-Max-Age', String(maxAge));
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
