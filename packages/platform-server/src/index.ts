/**
 * Platform Server
 * Low-code platform backend service with optimized architecture
 * 
 * Key Features:
 * - Standardized REST API responses
 * - Service layer for business logic separation
 * - Base controller pattern for consistent handling
 * - Type-safe validation with Zod
 * - Comprehensive error handling
 *
 * @module platform-server
 */

// ============================================================================
// Main Entry Point
// ============================================================================

export { App, type AppConfig } from './lib/App.js';

// ============================================================================
// Services (Business Logic Layer)
// ============================================================================

export {
  // Base Service
  BaseService,
  type BaseEntity,
  type ServiceOptions,
  type ListOptions,
  type PaginatedResult,
  // User Service
  UserService,
  type CreateUserInput,
  type UpdateUserInput,
  type SignupInput,
  type SigninInput,
  type AuthResult,
  type SafeUser,
  // Project Service
  ProjectService,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectWithRole,
  type ProjectUserInfo,
  // Page Service
  PageService,
  type CreatePageInput,
  type UpdatePageInput,
  type PageReorderItem,
  // Flow Service
  FlowService,
  type CreateFlowInput,
  type UpdateFlowInput,
  type FlowReorderItem,
} from './services/index.js';

// ============================================================================
// Controllers Layer (API Handlers)
// ============================================================================

export {
  // Base Controller
  BaseController,
  asyncHandler,
  createHandler,
  type HandlerContext,
  type ControllerHandler,
  type ValidationSchemas,
  type ActionOptions,
  // Router Factories
  createAuthRouter,
  createUserRouter,
  createProjectRouter,
  createPageRouter,
  createFlowRouter,
  createTableRouter,
  tableContextMiddleware,
  // Handler Functions (for testing/extension)
  signup,
  signin,
  me,
  projectList,
  projectGet,
  projectCreate,
  projectUpdate,
  projectDelete,
  pageList,
  pageGet,
  pageCreate,
  pageUpdate,
  pageDelete,
  pageSave,
  flowList,
  flowGet,
  flowCreate,
  flowUpdate,
  flowDelete,
  flowSave,
  schemaSave,
  tableSave,
} from './controllers/index.js';

// ============================================================================
// Response Utilities
// ============================================================================

export {
  // Response Helpers
  apiResponse,
  sendSuccess,
  sendList,
  sendCreated,
  sendNoContent,
  sendAccepted,
  // Pagination
  parsePagination,
  createPaginationMeta,
  PAGINATION_DEFAULTS,
  // Types
  type SuccessResponse,
  type ListResponse,
  type ResponseMeta,
  type ListMeta,
  type ErrorResponseBody,
  type PaginationParams,
} from './utils/response.js';

// ============================================================================
// Database Layer
// ============================================================================

export {
  // Database Manager
  DatabaseManager,
  getDbManager,
  getDb,
  getDatabaseType,
  // Migration Runner
  MigrationRunner,
  // Migrations
  MIGRATIONS,
  runMigrations,
  rollbackMigration,
  getMigrationStatus,
  // ID Generator
  IdGenerator,
  generateId,
  generateIdWithPrefix,
  ID_PREFIXES,
  // Types
  type DatabaseType,
  type DatabaseConfig,
  type ConnectionStatus,
  type Migration,
  type MigrationRecord,
  type MigrationResult,
  type IdPrefix,
} from './db/index.js';

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
// Repositories (Data Access Layer)
// ============================================================================

export {
  // Base Repository
  BaseRepository,
  genId,
  type RepositoryOptions,
  type QueryOptions,
  type BaseEntity as RepositoryBaseEntity,
  // User Repository
  UserRepository,
  type UserRecord,
  type CreateUserData,
  type UpdateUserData,
  // Project Repository
  ProjectRepository,
  type ProjectRecord,
  type CreateProjectData,
  type UpdateProjectData,
  type ProjectUserRecord,
  // Page Repository
  PageRepository,
  type PageRecord,
  type CreatePageData,
  type UpdatePageData,
  // Flow Repository
  FlowRepository,
  type FlowRecord,
  type CreateFlowData,
  type UpdateFlowData,
  // Schema Repository
  SchemaRepository,
  type SchemaRecord as RepoSchemaRecord,
  type CreateSchemaData,
  type UpdateSchemaData,
} from './repositories/index.js';

// ============================================================================
// Models (Domain Entities)
// ============================================================================

export {
  // Entity Classes
  User,
  Project,
  Page,
  Flow,
  Model,
  Schema,
  // Schema Types
  type JsonPatchOp,
  type JsonPatchOperation,
  type SchemaRecord,
  type SchemaCreateOptions,
  type SchemaPatchResult,
  // Table/Model Types
  type TableOptions,
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
  // Types
  type ValidationSchemas as MiddlewareValidationSchemas,
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
  ReorderSchema,
  CreatePageSchema,
  UpdatePageSchema,
  CreateFlowSchema,
  UpdateFlowSchema,
  CreateTableSchema,
  UpdateTableSchema,
  CreateColumnSchema,
  CreateLinkSchema,
  ImportSchemaSchema,
  // Input Types
  type SignupInput as SchemaSignupInput,
  type SigninInput as SchemaSigninInput,
  type CreateProjectInput as SchemaCreateProjectInput,
  type UpdateProjectInput as SchemaUpdateProjectInput,
  type CreatePageInput as SchemaCreatePageInput,
  type UpdatePageInput as SchemaUpdatePageInput,
  type CreateFlowInput as SchemaCreateFlowInput,
  type UpdateFlowInput as SchemaUpdateFlowInput,
  type ListQueryInput,
} from './middleware/index.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Analysis Type Configuration
  AnalysisType,
  TeamType,
  TEAMS,
  ANALYSIS_TYPES,
  getTeamForAnalysisType,
  getTeamConfigForAnalysisType,
  getAnalysisTypeConfig,
  getAnalysisTypesForTeam,
  getAllTeams,
  getAllAnalysisTypes,
  isValidAnalysisType,
  isValidTeamType,
  getGroupIdForTeam,
  getGroupIdForAnalysisType,
  type TeamConfig,
  type AnalysisTypeConfig,
} from './config/analysisTeamConfig.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Pagination (from utils)
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
  type PaginatedResult as UtilPaginatedResult,
  type PageInfo,
  type CursorPaginationInput,
  type CursorPageInfo,
  type CursorPaginatedResult,
  type PaginatedQueryOptions,
} from './utils/index.js';

// ============================================================================
// Default Export
// ============================================================================

import { App } from './lib/App.js';
export default App;
