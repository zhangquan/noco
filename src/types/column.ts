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
 */
export type ColumnOption =
  | LinkColumnOption
  | FormulaColumnOption
  | RollupColumnOption
  | LookupColumnOption
  | SelectOption[];

// ============================================================================
// Column Definition
// ============================================================================

/**
 * Column definition
 */
export interface Column {
  id: string;
  title: string;
  column_name: string;
  uidt: UITypes;
  /** Database type */
  dt?: string;
  /** Is primary key */
  pk?: boolean;
  /** Is primary value (display column) */
  pv?: boolean;
  /** Is required */
  rqd?: boolean;
  /** Is unsigned */
  un?: boolean;
  /** Is auto increment */
  ai?: boolean;
  /** Default value */
  cdf?: string;
  /** Column comment */
  cc?: string;
  /** Column metadata */
  meta?: Record<string, unknown>;
  /** Is system column */
  system?: boolean;
  /** Display order */
  order?: number;
  /** Foreign key to model */
  fk_model_id?: string;
  /** Column-specific options */
  colOptions?: ColumnOption;
}

// ============================================================================
// System Column Constants
// ============================================================================

/**
 * System column UI types
 */
export const SYSTEM_COLUMN_TYPES: UITypes[] = [
  UITypes.ID,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
];

/**
 * Virtual column UI types (computed, not stored directly)
 */
export const VIRTUAL_COLUMN_TYPES: UITypes[] = [
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
];

/**
 * System column name mapping
 */
export const SYSTEM_COLUMN_NAMES: Partial<Record<UITypes, string>> = {
  [UITypes.ID]: 'id',
  [UITypes.CreatedTime]: 'created_at',
  [UITypes.LastModifiedTime]: 'updated_at',
  [UITypes.CreatedBy]: 'created_by',
  [UITypes.LastModifiedBy]: 'updated_by',
};

/**
 * Default ID column definition
 */
export const DEFAULT_ID_COLUMN: Column = {
  id: '__nc_id__',
  title: 'Id',
  column_name: 'id',
  uidt: UITypes.ID,
  pk: true,
  system: true,
};
