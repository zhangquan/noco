/**
 * System Constants
 * @module types/constants
 */

import { UITypes } from './column';
import type { Column } from './column';

// ============================================================================
// System Column Types
// ============================================================================

/**
 * System column UI types (auto-managed by the system)
 */
export const SYSTEM_COLUMN_TYPES: readonly UITypes[] = [
  UITypes.ID,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
] as const;

/**
 * Virtual column UI types (computed, not stored directly in DB)
 */
export const VIRTUAL_COLUMN_TYPES: readonly UITypes[] = [
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
] as const;

/**
 * Link column UI types
 */
export const LINK_COLUMN_TYPES: readonly UITypes[] = [
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
] as const;

/**
 * Select column UI types
 */
export const SELECT_COLUMN_TYPES: readonly UITypes[] = [
  UITypes.SingleSelect,
  UITypes.MultiSelect,
] as const;

// ============================================================================
// System Column Name Mapping
// ============================================================================

/**
 * Default column names for system columns
 */
export const SYSTEM_COLUMN_NAMES: Readonly<Partial<Record<UITypes, string>>> = {
  [UITypes.ID]: 'id',
  [UITypes.CreatedTime]: 'created_at',
  [UITypes.LastModifiedTime]: 'updated_at',
  [UITypes.CreatedBy]: 'created_by',
  [UITypes.LastModifiedBy]: 'updated_by',
} as const;

// ============================================================================
// Default Column Definitions
// ============================================================================

/**
 * Default ID column definition
 */
export const DEFAULT_ID_COLUMN: Readonly<Column> = {
  id: '__jm_id__',
  title: 'Id',
  name: 'id',
  uidt: UITypes.ID,
  pk: true,
  system: true,
} as const;

/**
 * Default created_at column definition
 */
export const DEFAULT_CREATED_AT_COLUMN: Readonly<Column> = {
  id: '__jm_created_at__',
  title: 'Created At',
  name: 'created_at',
  uidt: UITypes.CreatedTime,
  system: true,
} as const;

/**
 * Default updated_at column definition
 */
export const DEFAULT_UPDATED_AT_COLUMN: Readonly<Column> = {
  id: '__jm_updated_at__',
  title: 'Updated At',
  name: 'updated_at',
  uidt: UITypes.LastModifiedTime,
  system: true,
} as const;

/**
 * All default system columns
 */
export const DEFAULT_SYSTEM_COLUMNS: readonly Column[] = [
  DEFAULT_ID_COLUMN,
  DEFAULT_CREATED_AT_COLUMN,
  DEFAULT_UPDATED_AT_COLUMN,
] as const;

// ============================================================================
// Query Defaults
// ============================================================================

/**
 * Default query limits
 */
export const QUERY_DEFAULTS = {
  /** Default page size for list queries */
  PAGE_SIZE: 25,
  /** Maximum page size */
  MAX_PAGE_SIZE: 1000,
  /** Default query timeout in milliseconds */
  QUERY_TIMEOUT: 30000,
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a UI type is a system column type
 */
export function isSystemColumnType(uidt: UITypes | string): boolean {
  return SYSTEM_COLUMN_TYPES.includes(uidt as UITypes);
}

/**
 * Check if a UI type is a virtual column type
 */
export function isVirtualColumnType(uidt: UITypes | string): boolean {
  return VIRTUAL_COLUMN_TYPES.includes(uidt as UITypes);
}

/**
 * Check if a UI type is a link column type
 */
export function isLinkColumnType(uidt: UITypes | string): boolean {
  return LINK_COLUMN_TYPES.includes(uidt as UITypes);
}

/**
 * Check if a UI type is a select column type
 */
export function isSelectColumnType(uidt: UITypes | string): boolean {
  return SELECT_COLUMN_TYPES.includes(uidt as UITypes);
}
