/**
 * Platform Server Type Definitions
 * @module types
 */

import type { Request } from 'express';
import type { Knex } from 'knex';

// ============================================================================
// Model Types (SDK-compatible)
// ============================================================================

/**
 * Model/Table types enum
 */
export enum ModelTypes {
  TABLE = 'table',
  VIEW = 'view',
}

/**
 * UI Types for columns
 */
export enum UITypes {
  ID = 'ID',
  SingleLineText = 'SingleLineText',
  LongText = 'LongText',
  Number = 'Number',
  Decimal = 'Decimal',
  Currency = 'Currency',
  Percent = 'Percent',
  Rating = 'Rating',
  Checkbox = 'Checkbox',
  Date = 'Date',
  DateTime = 'DateTime',
  Time = 'Time',
  Duration = 'Duration',
  Email = 'Email',
  PhoneNumber = 'PhoneNumber',
  URL = 'URL',
  SingleSelect = 'SingleSelect',
  MultiSelect = 'MultiSelect',
  Attachment = 'Attachment',
  JSON = 'JSON',
  Formula = 'Formula',
  Rollup = 'Rollup',
  Lookup = 'Lookup',
  LinkToAnotherRecord = 'LinkToAnotherRecord',
  Links = 'Links',
  User = 'User',
  CreatedBy = 'CreatedBy',
  LastModifiedBy = 'LastModifiedBy',
  CreatedTime = 'CreatedTime',
  LastModifiedTime = 'LastModifiedTime',
  AutoNumber = 'AutoNumber',
  Barcode = 'Barcode',
  QrCode = 'QrCode',
  GeoData = 'GeoData',
  Geometry = 'Geometry',
}

/**
 * View types enum
 */
export enum ViewTypes {
  GRID = 'grid',
  FORM = 'form',
  GALLERY = 'gallery',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
}

/**
 * Column type definition (SDK-compatible)
 */
export interface ColumnType {
  id: string;
  title: string;
  column_name?: string;
  uidt: UITypes | string;
  dt?: string;
  pk?: boolean;
  pv?: boolean;
  required?: boolean;
  system?: boolean;
  order?: number;
  default_value?: unknown;
  meta?: Record<string, unknown>;
  colOptions?: Record<string, unknown>;
  constraints?: {
    required?: boolean;
    unique?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enumValues?: string[];
  };
  description?: string;
  examples?: unknown[];
}

/**
 * View type definition
 */
export interface ViewType {
  id: string;
  title: string;
  type: ViewTypes;
  fk_model_id: string;
  order?: number;
  show_system_fields?: boolean;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  meta?: Record<string, unknown>;
}

/**
 * Filter type definition
 */
export interface FilterType {
  id?: string;
  fk_column_id?: string;
  logical_op?: 'and' | 'or';
  comparison_op?: string;
  value?: unknown;
  is_group?: boolean;
  children?: FilterType[];
}

/**
 * Sort type definition
 */
export interface SortType {
  id?: string;
  fk_column_id?: string;
  direction?: 'asc' | 'desc';
  order?: number;
}

/**
 * Table/Model type definition (SDK-compatible)
 */
export interface TableType {
  // Basic identification
  id: string;
  title: string;
  table_name?: string;
  slug?: string;
  uuid?: string;
  type?: ModelTypes;

  // Hierarchy
  project_id?: string;
  base_id?: string;
  group_id?: string;
  parent_id?: string;
  fk_project_id?: string;
  fk_base_id?: string;

  // Schema association
  fk_schema_id?: string;
  fk_public_schema_id?: string;
  columns?: ColumnType[];
  views?: ViewType[];

  // Configuration
  enabled?: boolean;
  deleted?: boolean;
  copy_enabled?: boolean;
  export_enabled?: boolean;
  pin?: boolean;
  pinned?: boolean;
  show_all_fields?: boolean;
  password?: string;

  // Publish state
  is_publish?: boolean;
  need_publish?: boolean;
  publish_at?: Date;

  // BigTable storage
  bigtable_table_name?: MetaTable;
  mm?: boolean;

  // Metadata
  order?: number;
  meta?: Record<string, unknown>;
  description?: string;
  hints?: string[];
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Check if a column is a text column
 */
export function isTextCol(col: ColumnType): boolean {
  const textTypes = [
    UITypes.SingleLineText,
    UITypes.LongText,
    UITypes.Email,
    UITypes.PhoneNumber,
    UITypes.URL,
  ];
  return textTypes.includes(col.uidt as UITypes);
}

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
  MODELS = 'nc_models',
  PAGES = 'nc_pages',
  FLOWS = 'nc_flows',
  SCHEMAS = 'nc_schemas',
  ORGS = 'nc_orgs',
  ORG_USERS = 'nc_org_users',
  PUBLISH_STATES = 'nc_publish_states',
  BIGTABLE = 'nc_bigtable',
  BIGTABLE_RELATIONS = 'nc_bigtable_relations',
  AUDIT = 'nc_audit',
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
