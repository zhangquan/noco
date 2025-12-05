/**
 * Platform Server
 * Low-code platform backend service based on Express.js and AgentDB
 *
 * @module platform-server
 */

// ============================================================================
// Main Entry Point
// ============================================================================

export { App, type AppConfig } from './lib/App.js';
export { runMigrations, rollbackMigration } from './lib/migrations.js';
export { NcMetaIO, initNcMeta, getNcMeta } from './lib/NcMetaIO.js';

// ============================================================================
// Cache
// ============================================================================

export {
  NocoCache,
  initCache,
  getCache,
  type CacheConfig,
  type ICacheStore,
} from './cache/index.js';

// ============================================================================
// Auth
// ============================================================================

export {
  configureAuth,
  getAuthConfig,
  configurePassport,
  generateToken,
  generateTokenPair,
  verifyToken,
  refreshToken,
  refreshTokenPair,
  blacklistToken,
  cleanupBlacklist,
  requireAuth,
  optionalAuth,
  requireProjectPermission,
  requireRole,
  requireApiKey,
  setAuthCookies,
  clearAuthCookies,
  type AuthConfig,
  type TokenPair,
} from './auth/index.js';

// ============================================================================
// Models
// ============================================================================

export {
  User,
  Project,
  Database,
  AppModel,
  Page,
  FlowApp,
  Flow,
  type BaseModelOptions,
} from './models/index.js';

// ============================================================================
// Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Errors
// ============================================================================

export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  DatabaseError,
  InternalError,
  BadRequestError,
  Errors,
  ErrorCode,
  isApiError,
  isOperationalError,
  getHttpStatusCode,
  formatErrorResponse,
  type ErrorDetails,
  type ApiErrorOptions,
  type ErrorResponse,
} from './errors/index.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  // Validation
  validate,
  validateBody,
  validateQuery,
  validateParams,
  // Logging
  Logger,
  LogLevel,
  initLogger,
  getLogger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  logAuditEvent,
  // Health
  performHealthCheck,
  createHealthRouter,
  simpleHealthCheck,
  HealthStatus,
  // Rate Limiting
  createRateLimit,
  createRateLimitFromPreset,
  createDynamicRateLimit,
  createSlidingWindowRateLimit,
  RateLimitPresets,
  // Error Handling
  createErrorHandler,
  notFoundHandler,
  asyncHandler,
  // Types
  type ValidationSchemas,
  type ParsedRequest,
  type LogEntry,
  type RequestLogData,
  type ResponseLogData,
  type LoggerConfig,
  type AuditLogEntry,
  type ComponentHealth,
  type HealthCheckResult,
  type HealthCheckConfig,
  type RateLimitConfig,
  type ErrorHandlerOptions,
} from './middleware/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

export {
  // Common Schemas
  IdSchema,
  UlidSchema,
  PaginationSchema,
  SortSchema,
  ListQuerySchema,
  EmailSchema,
  PasswordSchema,
  TitleSchema,
  DescriptionSchema,
  // API Schemas
  SignupSchema,
  SigninSchema,
  RefreshTokenSchema,
  PasswordResetRequestSchema,
  PasswordResetSchema,
  ChangePasswordSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectIdParamsSchema,
  UpdateProfileSchema,
  UpdateUserSchema,
  InviteUserSchema,
  CreateAppSchema,
  UpdateAppSchema,
  ReorderSchema,
  CreatePageSchema,
  UpdatePageSchema,
  CreateFlowAppSchema,
  UpdateFlowAppSchema,
  CreateFlowSchema,
  UpdateFlowSchema,
  CreateTableSchema,
  UpdateTableSchema,
  CreateColumnSchema,
  CreateLinkSchema,
  ImportSchemaSchema,
  // Input Types
  type SignupInput,
  type SigninInput,
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreateAppInput,
  type UpdateAppInput,
  type CreatePageInput,
  type UpdatePageInput,
  type CreateFlowAppInput,
  type UpdateFlowAppInput,
  type CreateFlowInput,
  type UpdateFlowInput,
  type ListQueryInput,
} from './middleware/index.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Pagination
  parsePaginationOptions,
  parseSortOptions,
  createPageInfo,
  applyPagination,
  applySort,
  getCount,
  paginatedQuery,
  encodeCursor,
  decodeCursor,
  cursorPaginatedQuery,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  // Common Utils
  sleep,
  retry,
  memoizeAsync,
  debounce,
  throttle,
  groupBy,
  pick,
  omit,
  deepMerge,
  isEmpty,
  compact,
  randomString,
  slugify,
  chunk,
  parallelLimit,
  createDeferred,
  withTimeout,
  // Types
  type PaginationInput,
  type SortInput,
  type PaginationOptions,
  type PaginatedResult,
  type PageInfo,
  type CursorPaginationInput,
  type CursorPageInfo,
  type CursorPaginatedResult,
  type PaginatedQueryOptions,
} from './utils/index.js';

// ============================================================================
// Meta APIs
// ============================================================================

export {
  createProjectRouter,
  createTableRouter,
  createAppRouter,
  createPageRouter,
  createFlowAppRouter,
  createAuthRouter,
  createUserRouter,
} from './meta/api/index.js';

// ============================================================================
// Default Export
// ============================================================================

import { App } from './lib/App.js';
export default App;
