/**
 * REST API Configuration
 * @module rest-api/config
 */

/**
 * REST API configuration options
 */
export interface RestApiConfig {
  // === Route Configuration ===
  /** Base path for API routes */
  basePath: string;
  /** Enable public (shared view) APIs */
  enablePublicApi: boolean;
  /** Enable export APIs (CSV/Excel) */
  enableExportApi: boolean;

  // === Pagination Configuration ===
  /** Default page size for list queries */
  defaultPageSize: number;
  /** Maximum allowed page size */
  maxPageSize: number;

  // === Bulk Operation Configuration ===
  /** Maximum items per bulk operation */
  maxBulkSize: number;
  /** Chunk size for batch processing */
  bulkChunkSize: number;

  // === Export Configuration ===
  /** Maximum rows for export */
  maxExportRows: number;
  /** Export timeout in milliseconds */
  exportTimeout: number;
  /** Export batch size */
  exportBatchSize: number;

  // === Rate Limiting Configuration ===
  /** Enable rate limiting */
  enableRateLimit: boolean;
  /** Rate limit window in milliseconds */
  rateLimitWindow: number;
  /** Maximum requests per window */
  rateLimitMax: number;

  // === Auth Configuration ===
  /** Allow anonymous read access */
  allowAnonymousRead: boolean;

  // === CORS Configuration ===
  /** Enable CORS */
  enableCors: boolean;
  /** Allowed origins */
  corsOrigins: string[];
  /** Allowed methods */
  corsMethods: string[];
  /** Allowed headers */
  corsHeaders: string[];

  // === Logging Configuration ===
  /** Enable request logging */
  enableLogging: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: RestApiConfig = {
  // Route
  basePath: '/api/v1/data',
  enablePublicApi: true,
  enableExportApi: true,

  // Pagination
  defaultPageSize: 25,
  maxPageSize: 1000,

  // Bulk
  maxBulkSize: 1000,
  bulkChunkSize: 100,

  // Export
  maxExportRows: 10000,
  exportTimeout: 30000,
  exportBatchSize: 100,

  // Rate Limit
  enableRateLimit: false,
  rateLimitWindow: 60000,
  rateLimitMax: 100,

  // Auth
  allowAnonymousRead: true,

  // CORS
  enableCors: false,
  corsOrigins: ['*'],
  corsMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  corsHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],

  // Logging
  enableLogging: true,
  logLevel: 'info',
};

/**
 * Create a configuration object with custom overrides
 */
export function createConfig(overrides?: Partial<RestApiConfig>): RestApiConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Global configuration instance
 */
let globalConfig: RestApiConfig = DEFAULT_CONFIG;

/**
 * Set global configuration
 */
export function setConfig(config: Partial<RestApiConfig>): void {
  globalConfig = createConfig(config);
}

/**
 * Get current global configuration
 */
export function getConfig(): RestApiConfig {
  return globalConfig;
}
