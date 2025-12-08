/**
 * Platform Server Type Definitions
 * 
 * This module provides centralized type exports organized by domain:
 * - enums.ts: Enumerations and type aliases
 * - entities.ts: Database entity interfaces
 * - acl.ts: Access control and permissions
 * - request.ts: API request/response types
 * 
 * @module types
 */

// ============================================================================
// Enums & Type Aliases
// ============================================================================

export {
  CacheScope,
  MetaTable,
  type UserRole,
  type ProjectRole,
  type OrgRole,
  type DatabaseType,
  type FlowTriggerType,
  type SchemaDomain,
  type SchemaEnv,
  type PublishStatus,
} from './enums.js';

// ============================================================================
// Entity Types
// ============================================================================

export type {
  // Base
  BaseEntity,
  // User
  User,
  SafeUser,
  // Project
  Project,
  ProjectUser,
  // Database
  Database,
  // Page
  Page,
  // Flow
  Flow,
  // Schema
  SchemaData,
  // Organization
  Org,
  OrgUser,
  // Publish
  PublishState,
  // Input types
  UserCreateInput,
  UserUpdateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
  PageCreateInput,
  PageUpdateInput,
  FlowCreateInput,
  FlowUpdateInput,
} from './entities.js';

// ============================================================================
// ACL Types
// ============================================================================

export {
  PROJECT_ACL,
  hasPermission,
  getPermissions,
  canWrite,
  isRoleAtLeast,
  type AclOperation,
  type AclPermission,
  type Acl,
} from './acl.js';

// ============================================================================
// Request Types
// ============================================================================

export type {
  JwtPayload,
  RequestContext,
  ApiRequest,
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
  ListQueryParams,
  ListOptions,
} from './request.js';

export {
  parseListQuery,
  buildPageInfo,
} from './request.js';
