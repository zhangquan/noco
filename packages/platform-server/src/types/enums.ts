/**
 * Enumeration Type Definitions
 * @module types/enums
 */

// ============================================================================
// Cache Scope
// ============================================================================

/**
 * Cache key scopes for different entity types
 */
export enum CacheScope {
  USER = 'user',
  PROJECT = 'project',
  BASE = 'base',
  MODEL = 'model',
  PAGE = 'page',
  FLOW = 'flow',
  SCHEMA = 'schema',
  ORG = 'org',
  PROJECT_USER = 'project_user',
  ORG_USER = 'org_user',
}

// ============================================================================
// Meta Table Names
// ============================================================================

/**
 * Database table names for metadata storage
 */
export enum MetaTable {
  USERS = 'nc_users',
  PROJECTS = 'nc_projects',
  PROJECT_USERS = 'nc_project_users',
  BASES = 'nc_bases',
  PAGES = 'nc_pages',
  FLOWS = 'nc_flows',
  SCHEMAS = 'nc_schemas',
  ORGS = 'nc_orgs',
  ORG_USERS = 'nc_org_users',
  PUBLISH_STATES = 'nc_publish_states',
}

// ============================================================================
// Role Types
// ============================================================================

/**
 * User role types (system-wide)
 */
export type UserRole = 'super' | 'org-level-creator' | 'org-level-viewer' | 'user' | 'guest';

/**
 * Project role types
 */
export type ProjectRole = 'owner' | 'creator' | 'editor' | 'viewer' | 'commenter' | 'guest';

/**
 * Organization role types
 */
export type OrgRole = 'super' | 'creator' | 'viewer';

// ============================================================================
// Other Enums
// ============================================================================

/**
 * Database types supported
 */
export type DatabaseType = 'pg' | 'mysql' | 'sqlite' | 'mssql';

/**
 * Flow trigger types
 */
export type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'record' | 'form';

/**
 * Schema domain types
 */
export type SchemaDomain = 'model' | 'app' | 'page' | 'flow';

/**
 * Schema environment types
 */
export type SchemaEnv = 'DEV' | 'PRO';

/**
 * Publish status types
 */
export type PublishStatus = 'draft' | 'published' | 'publishing';
