/**
 * Column type definitions
 * @module types/column
 */

// ============================================================================
// Column UI Types
// ============================================================================

/**
 * UI Type enum for column display types
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
  SpecificDBType = 'SpecificDBType',
}

/**
 * Relation types for linked records
 */
export enum RelationTypes {
  HAS_MANY = 'hm',
  BELONGS_TO = 'bt',
  MANY_TO_MANY = 'mm',
}

// ============================================================================
// Column Option Types
// ============================================================================

/**
 * Base column option type
 */
export interface BaseColumnOption {
  id?: string;
  fk_column_id?: string;
}

/**
 * Link to another record column options
 */
export interface LinkColumnOption extends BaseColumnOption {
  type: RelationTypes;
  fk_related_model_id?: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  /** Alias for fk_mm_model_id */
  mm_model_id?: string;
  virtual?: boolean;
}

/**
 * Formula column options
 */
export interface FormulaColumnOption extends BaseColumnOption {
  formula?: string;
  formula_raw?: string;
  parsed_tree?: unknown;
}

/**
 * Rollup function types
 */
export type RollupFunction =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'countEmpty'
  | 'countNotEmpty'
  | 'countDistinct'
  | 'sumDistinct'
  | 'avgDistinct';

/**
 * Rollup column options
 */
export interface RollupColumnOption extends BaseColumnOption {
  fk_relation_column_id?: string;
  fk_relation_table_id?: string;
  fk_rollup_column_id?: string;
  rollup_function?: RollupFunction;
}

/**
 * Lookup column options
 */
export interface LookupColumnOption extends BaseColumnOption {
  fk_relation_column_id?: string;
  fk_lookup_column_id?: string;
}

/**
 * Select option for SingleSelect/MultiSelect
 */
export interface SelectOption {
  id?: string;
  title?: string;
  color?: string;
  order?: number;
}

/**
 * All possible column option types
 * @deprecated Use specific option types from column-options.ts
 */
export type ColumnOption =
  | LinkColumnOption
  | FormulaColumnOption
  | RollupColumnOption
  | LookupColumnOption
  | SelectOption[];

// Re-export new option types for convenience
export type {
  LinkColumnOptions,
  FormulaColumnOptions,
  RollupColumnOptions,
  LookupColumnOptions,
  SelectColumnOptions,
  SelectOption as SelectOptionItem,
} from './column-options';

// ============================================================================
// Column Constraints (AI-friendly)
// ============================================================================

/**
 * Column constraints for validation and AI understanding
 */
export interface ColumnConstraints {
  /** Field is required */
  required?: boolean;
  /** Value must be unique across all records */
  unique?: boolean;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
  /** Regex pattern for validation */
  pattern?: string;
  /** Valid enum values (for SingleSelect/MultiSelect) */
  enumValues?: string[];
}

// ============================================================================
// Column Definition
// ============================================================================

/**
 * Column definition
 */
export interface Column {
  /** Unique column identifier */
  id: string;
  /** Display title */
  title: string;
  /** Column name in data (defaults to id if not specified) */
  name?: string;
  /** UI type */
  uidt: UITypes | string;
  /** Database type */
  dt?: string;
  /** Is primary key */
  pk?: boolean;
  /** Is primary value (display column) */
  pv?: boolean;
  /** Is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Column metadata */
  meta?: Record<string, unknown>;
  /** Is system column */
  system?: boolean;
  /** Display order */
  order?: number;
  /** Column-specific options */
  options?: ColumnOption;
  
  // === AI-friendly fields ===
  /** Human-readable description of this column's purpose */
  description?: string;
  /** Example values to help AI understand the expected format */
  examples?: unknown[];
  /** Validation constraints */
  constraints?: ColumnConstraints;
  
  // Legacy field names (deprecated)
  /** @deprecated Use name instead */
  column_name?: string;
  /** @deprecated Use required instead */
  rqd?: boolean;
  /** @deprecated Use defaultValue instead */
  cdf?: string;
  /** @deprecated Use options instead */
  colOptions?: ColumnOption;
}

/**
 * Get the effective column name (handles legacy field)
 */
export function getColumnName(column: Column): string {
  return column.name || column.column_name || column.id;
}

// ============================================================================
// Column Type Guards
// ============================================================================

/**
 * Check if column is a link column (Links or LinkToAnotherRecord)
 */
export function isLinkColumn(column: Column): boolean {
  return column.uidt === UITypes.Links || column.uidt === UITypes.LinkToAnotherRecord;
}

/**
 * Check if column is a formula column
 */
export function isFormulaColumn(column: Column): boolean {
  return column.uidt === UITypes.Formula;
}

/**
 * Check if column is a rollup column
 */
export function isRollupColumn(column: Column): boolean {
  return column.uidt === UITypes.Rollup;
}

/**
 * Check if column is a lookup column
 */
export function isLookupColumn(column: Column): boolean {
  return column.uidt === UITypes.Lookup;
}

/**
 * Check if column is a select column (Single or Multi)
 */
export function isSelectColumn(column: Column): boolean {
  return column.uidt === UITypes.SingleSelect || column.uidt === UITypes.MultiSelect;
}

/**
 * Check if column is a virtual column (computed, not stored)
 */
export function isVirtualColumn(column: Column): boolean {
  return (
    column.uidt === UITypes.Formula ||
    column.uidt === UITypes.Rollup ||
    column.uidt === UITypes.Lookup ||
    column.uidt === UITypes.Links ||
    column.uidt === UITypes.LinkToAnotherRecord
  );
}

/**
 * Check if column is a system column
 */
export function isSystemColumn(column: Column): boolean {
  return (
    column.system === true ||
    column.uidt === UITypes.ID ||
    column.uidt === UITypes.CreatedTime ||
    column.uidt === UITypes.LastModifiedTime ||
    column.uidt === UITypes.CreatedBy ||
    column.uidt === UITypes.LastModifiedBy
  );
}

/**
 * Get column options safely (handles colOptions vs options)
 */
export function getColumnOptions(column: Column): Record<string, unknown> | null {
  const opts = column.colOptions || column.options;
  if (!opts) return null;
  if (typeof opts === 'string') {
    try {
      return JSON.parse(opts);
    } catch {
      return null;
    }
  }
  return opts as Record<string, unknown>;
}

// ============================================================================
// System Column Constants
// Re-exported from constants.ts for backward compatibility
// ============================================================================

export {
  SYSTEM_COLUMN_TYPES,
  VIRTUAL_COLUMN_TYPES,
  SYSTEM_COLUMN_NAMES,
  DEFAULT_ID_COLUMN,
} from './constants';
