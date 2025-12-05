/**
 * Structured Logging Middleware
 * Request tracing and structured log output
 * @module middleware/logging
 */

import type { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';
import type { ApiRequest } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  service: string;
  [key: string]: unknown;
}

export interface RequestLogData {
  method: string;
  url: string;
  path: string;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  userId?: string;
  contentLength?: number;
}

export interface ResponseLogData {
  statusCode: number;
  contentLength?: number;
  durationMs: number;
}

export interface LoggerConfig {
  serviceName?: string;
  logLevel?: LogLevel;
  jsonFormat?: boolean;
  includeRequestBody?: boolean;
  excludePaths?: string[];
  sensitiveFields?: string[];
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      serviceName: config.serviceName || 'platform-server',
      logLevel: config.logLevel || LogLevel.INFO,
      jsonFormat: config.jsonFormat ?? (process.env.NODE_ENV === 'production'),
      includeRequestBody: config.includeRequestBody ?? false,
      excludePaths: config.excludePaths || ['/health', '/favicon.ico'],
      sensitiveFields: config.sensitiveFields || ['password', 'token', 'secret', 'apiKey', 'authorization'],
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.config.logLevel);
  }

  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.config.sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private formatLog(entry: LogEntry): string {
    if (this.config.jsonFormat) {
      return JSON.stringify(entry);
    }

    const { level, message, timestamp, requestId, ...rest } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]${requestId ? ` [${requestId}]` : ''}`;
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${prefix} ${message}${extra}`;
  }

  log(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      ...this.sanitize(data),
    };

    const output = this.formatLog(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...data,
    } : { error, ...data };
    this.log(LogLevel.ERROR, message, errorData);
  }

  getConfig(): Required<LoggerConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let loggerInstance: Logger | null = null;

export function initLogger(config?: LoggerConfig): Logger {
  loggerInstance = new Logger(config);
  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

// ============================================================================
// Request ID Middleware
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string || ulid();
    req.id = requestId;
    req.startTime = Date.now();
    res.setHeader('X-Request-Id', requestId);
    next();
  };
}

// ============================================================================
// Request Logging Middleware
// ============================================================================

export function requestLoggingMiddleware(config: LoggerConfig = {}) {
  const logger = new Logger(config);
  const excludePaths = new Set(config.excludePaths || ['/health', '/favicon.ico']);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip excluded paths
    if (excludePaths.has(req.path)) {
      next();
      return;
    }

    const startTime = req.startTime || Date.now();

    // Log request
    const requestData: RequestLogData = {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: (req as ApiRequest).user?.id,
    };

    if (Object.keys(req.query).length > 0) {
      requestData.query = req.query as Record<string, unknown>;
    }

    if (Object.keys(req.params).length > 0) {
      requestData.params = req.params as Record<string, unknown>;
    }

    if (req.get('content-length')) {
      requestData.contentLength = parseInt(req.get('content-length')!, 10);
    }

    logger.info('Request received', {
      requestId: req.id,
      ...requestData,
    });

    // Capture response
    const originalSend = res.send;
    let responseBody: unknown;

    res.send = function (body): Response {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Log response on finish
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      const responseData: ResponseLogData = {
        statusCode: res.statusCode,
        durationMs,
      };

      if (res.get('content-length')) {
        responseData.contentLength = parseInt(res.get('content-length')!, 10);
      }

      const level = res.statusCode >= 500 ? LogLevel.ERROR :
                    res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

      logger.log(level, 'Request completed', {
        requestId: req.id,
        ...requestData,
        ...responseData,
      });
    });

    next();
  };
}

// ============================================================================
// Error Logging Middleware
// ============================================================================

export function errorLoggingMiddleware(config: LoggerConfig = {}) {
  const logger = new Logger(config);

  return (err: Error, req: Request, res: Response, next: NextFunction): void => {
    logger.error('Request error', err, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      userId: (req as ApiRequest).user?.id,
    });

    next(err);
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  projectId?: string;
  changes?: Record<string, { before?: unknown; after?: unknown }>;
  metadata?: Record<string, unknown>;
}

export function logAuditEvent(entry: AuditLogEntry): void {
  const logger = getLogger();
  logger.info(`Audit: ${entry.action}`, {
    type: 'audit',
    ...entry,
  });
}

// ============================================================================
// Exports
// ============================================================================

export { Logger };
export default {
  initLogger,
  getLogger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logAuditEvent,
};
