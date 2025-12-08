/**
 * Entity Type Definitions
 * @module types/entities
 */

import type {
  UserRole,
  ProjectRole,
  OrgRole,
  DatabaseType,
  FlowTriggerType,
  SchemaDomain,
  SchemaEnv,
  PublishStatus,
} from './enums.js';

// ============================================================================
// Base Entity Interface
// ============================================================================

/**
 * Base interface for all entities with timestamps
 */
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// User Entity
// ============================================================================

/**
 * User entity
 */
export interface User extends BaseEntity {
  email: string;
  password?: string;
  salt?: string;
  firstname?: string;
  lastname?: string;
  roles: UserRole;
  invite_token?: string;
  invite_token_expires?: Date;
  reset_password_token?: string;
  reset_password_expires?: Date;
  email_verification_token?: string;
  email_verified?: boolean;
  org_selected_id?: string;
}

/**
 * User without sensitive fields
 */
export type SafeUser = Omit<User, 'password' | 'salt'>;

// ============================================================================
// Project Entity
// ============================================================================

/**
 * Project entity
 */
export interface Project extends BaseEntity {
  title: string;
  prefix: string;
  description?: string;
  org_id?: string;
  is_meta?: boolean;
  deleted?: boolean;
  order?: number;
  color?: string;
  meta?: Record<string, unknown>;
}

/**
 * Project-User relationship
 */
export interface ProjectUser extends BaseEntity {
  project_id: string;
  user_id: string;
  roles: ProjectRole;
  starred?: boolean;
  hidden?: boolean;
  order?: number;
}

// ============================================================================
// Database/Base Entity
// ============================================================================

/**
 * Database/Base entity
 */
export interface Database extends BaseEntity {
  project_id: string;
  alias?: string;
  type: DatabaseType;
  is_default_data_server_db: boolean;
  is_meta?: boolean;
  config?: string; // Encrypted connection config
  inflection_column?: string;
  inflection_table?: string;
  order?: number;
  enabled?: boolean;
}

// ============================================================================
// Page Entity
// ============================================================================

/**
 * Page entity
 */
export interface Page extends BaseEntity {
  project_id: string;
  group_id?: string;
  title: string;
  route?: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  order?: number;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Flow Entity
// ============================================================================

/**
 * Flow/Workflow entity
 */
export interface Flow extends BaseEntity {
  project_id: string;
  group_id?: string;
  title: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  trigger_type?: FlowTriggerType;
  enabled?: boolean;
  order?: number;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Schema Entity
// ============================================================================

/**
 * Schema data entity
 */
export interface SchemaData extends BaseEntity {
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data: Record<string, unknown>;
  env: SchemaEnv;
  version?: number;
}

// ============================================================================
// Organization Entity
// ============================================================================

/**
 * Organization entity
 */
export interface Org extends BaseEntity {
  title: string;
}

/**
 * Organization-User relationship
 */
export interface OrgUser extends BaseEntity {
  org_id: string;
  user_id: string;
  roles: OrgRole;
}

// ============================================================================
// Publish State Entity
// ============================================================================

/**
 * Publish state entity
 */
export interface PublishState extends BaseEntity {
  project_id: string;
  status: PublishStatus;
  published_at?: Date;
  published_by?: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Input Types (for create/update operations)
// ============================================================================

/**
 * User create input
 */
export interface UserCreateInput {
  email: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: UserRole;
  invite_token?: string;
}

/**
 * User update input
 */
export interface UserUpdateInput {
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  roles?: UserRole;
  org_selected_id?: string;
  email_verified?: boolean;
  reset_password_token?: string;
  reset_password_expires?: Date;
}

/**
 * Project create input
 */
export interface ProjectCreateInput {
  title: string;
  prefix?: string;
  description?: string;
  org_id?: string;
  meta?: Record<string, unknown>;
}

/**
 * Project update input
 */
export interface ProjectUpdateInput {
  title?: string;
  description?: string;
  order?: number;
  color?: string;
  meta?: Record<string, unknown>;
}

/**
 * Page create input
 */
export interface PageCreateInput {
  project_id: string;
  title: string;
  route?: string;
  group_id?: string;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

/**
 * Page update input
 */
export interface PageUpdateInput {
  title?: string;
  route?: string;
  order?: number;
  group_id?: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  meta?: Record<string, unknown>;
}

/**
 * Flow create input
 */
export interface FlowCreateInput {
  project_id: string;
  title: string;
  trigger_type?: FlowTriggerType;
  group_id?: string;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

/**
 * Flow update input
 */
export interface FlowUpdateInput {
  title?: string;
  trigger_type?: FlowTriggerType;
  enabled?: boolean;
  order?: number;
  group_id?: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  meta?: Record<string, unknown>;
}
