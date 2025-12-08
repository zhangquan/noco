/**
 * Platform Server Type Definitions
 * @module types
 */

import type { Request } from 'express';
import type { Knex } from 'knex';

// ============================================================================
// User & Auth Types
// ============================================================================

export interface User {
  id: string;
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
  created_at: Date;
  updated_at: Date;
}

export type UserRole = 'super' | 'org-level-creator' | 'org-level-viewer' | 'user' | 'guest';

export interface JwtPayload {
  id: string;
  email: string;
  roles?: UserRole;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Project Types
// ============================================================================

export interface Project {
  id: string;
  title: string;
  prefix: string;
  description?: string;
  org_id?: string;
  is_meta?: boolean;
  deleted?: boolean;
  order?: number;
  color?: string;
  meta?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectUser {
  id: string;
  project_id: string;
  user_id: string;
  roles: ProjectRole;
  starred?: boolean;
  hidden?: boolean;
  order?: number;
  created_at: Date;
  updated_at: Date;
}

export type ProjectRole = 'owner' | 'creator' | 'editor' | 'viewer' | 'commenter' | 'guest';

// ============================================================================
// Database/Base Types
// ============================================================================

export interface Database {
  id: string;
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
  created_at: Date;
  updated_at: Date;
}

export type DatabaseType = 'pg' | 'mysql' | 'sqlite' | 'mssql';

// ============================================================================
// Page Types
// ============================================================================

export interface Page {
  id: string;
  project_id: string;
  group_id?: string;
  title: string;
  route?: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  order?: number;
  meta?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Flow/Workflow Types
// ============================================================================

export interface Flow {
  id: string;
  project_id: string;
  group_id?: string;
  title: string;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  trigger_type?: FlowTriggerType;
  enabled?: boolean;
  order?: number;
  meta?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'record' | 'form';

// ============================================================================
// Schema Types
// ============================================================================

export interface SchemaData {
  id: string;
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data: Record<string, unknown>;
  env: SchemaEnv;
  version?: number;
  created_at: Date;
  updated_at: Date;
}

export type SchemaDomain = 'model' | 'app' | 'page' | 'flow';
export type SchemaEnv = 'DEV' | 'PRO';

// ============================================================================
// Org Types
// ============================================================================

export interface Org {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrgUser {
  id: string;
  org_id: string;
  user_id: string;
  roles: OrgRole;
  created_at: Date;
  updated_at: Date;
}

export type OrgRole = 'super' | 'creator' | 'viewer';

// ============================================================================
// Publish State Types
// ============================================================================

export interface PublishState {
  id: string;
  project_id: string;
  status: 'draft' | 'published' | 'publishing';
  published_at?: Date;
  published_by?: string;
  meta?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Request Context Types
// ============================================================================

export interface RequestContext {
  user?: User;
  projectId?: string;
  baseId?: string;
  trx?: Knex.Transaction;
}

export interface ApiRequest extends Request {
  user?: User;
  context?: RequestContext;
  ncProjectId?: string;
  ncBaseId?: string;
}

// ============================================================================
// Cache Scope
// ============================================================================

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
// ACL Types
// ============================================================================

export interface AclPermission {
  [operation: string]: boolean;
}

export interface ProjectAcl {
  [role: string]: AclPermission;
}

export const PROJECT_ACL: ProjectAcl = {
  owner: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
    invite: true,
    settings: true,
  },
  creator: {
    read: true,
    create: true,
    update: true,
    delete: true,
    publish: true,
    invite: false,
    settings: false,
  },
  editor: {
    read: true,
    create: true,
    update: true,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  viewer: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  commenter: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
  guest: {
    read: true,
    create: false,
    update: false,
    delete: false,
    publish: false,
    invite: false,
    settings: false,
  },
};
