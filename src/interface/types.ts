import type { Knex } from 'knex';

// ========================================
// Column Types
// ========================================

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

// ========================================
// Column Definitions
// ========================================

/**
 * Base column option type
 */
export interface BaseColumnOptionType {
  id?: string;
  fk_column_id?: string;
}

/**
 * Link to another record column options
 */
export interface LinkToAnotherRecordOptionType extends BaseColumnOptionType {
  type: RelationTypes;
  fk_related_model_id?: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_mm_child_column_id?: string;
  fk_mm_parent_column_id?: string;
  mm_model_id?: string; // Alias for fk_mm_model_id
  virtual?: boolean;
}

/**
 * Formula column options
 */
export interface FormulaOptionType extends BaseColumnOptionType {
  formula?: string;
  formula_raw?: string;
  parsed_tree?: any;
}

/**
 * Rollup column options
 */
export interface RollupOptionType extends BaseColumnOptionType {
  fk_relation_column_id?: string;
  fk_relation_table_id?: string;
  fk_rollup_column_id?: string;
  rollup_function?: RollupFunctionType;
}

/**
 * Lookup column options
 */
export interface LookupOptionType extends BaseColumnOptionType {
  fk_relation_column_id?: string;
  fk_lookup_column_id?: string;
}

/**
 * Rollup function types
 */
export type RollupFunctionType =
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
 * Select option for SingleSelect/MultiSelect
 */
export interface SelectOptionType {
  id?: string;
  title?: string;
  color?: string;
  order?: number;
}

/**
 * Column definition
 */
export interface ColumnType {
  id: string;
  title: string;
  column_name: string;
  uidt: UITypes;
  dt?: string; // Database type
  pk?: boolean;
  pv?: boolean; // Primary value (display column)
  rqd?: boolean; // Required
  un?: boolean; // Unsigned
  ai?: boolean; // Auto increment
  cdf?: string; // Default value
  cc?: string; // Column comment
  meta?: Record<string, any>;
  system?: boolean;
  order?: number;
  fk_model_id?: string;
  colOptions?:
    | LinkToAnotherRecordOptionType
    | FormulaOptionType
    | RollupOptionType
    | LookupOptionType
    | SelectOptionType[];
}

// ========================================
// Table/Model Definitions
// ========================================

/**
 * Table/Model definition
 */
export interface TableType {
  id: string;
  title: string;
  table_name: string;
  mm?: boolean; // Is many-to-many junction table
  type?: 'table' | 'view';
  meta?: Record<string, any>;
  columns?: ColumnType[];
  order?: number;
  fk_base_id?: string;
  fk_project_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * View definition
 */
export interface ViewType {
  id: string;
  title: string;
  type: ViewTypes;
  fk_model_id: string;
  order?: number;
  show_system_fields?: boolean;
  lock_type?: 'collaborative' | 'locked' | 'personal';
  meta?: Record<string, any>;
}

/**
 * View types
 */
export enum ViewTypes {
  GRID = 'grid',
  FORM = 'form',
  GALLERY = 'gallery',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
}

// ========================================
// Filter Definitions
// ========================================

/**
 * Filter comparison operators
 */
export type FilterComparisonOp =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'like'
  | 'nlike'
  | 'null'
  | 'notnull'
  | 'empty'
  | 'notempty'
  | 'in'
  | 'notin'
  | 'between'
  | 'notbetween'
  | 'allof'
  | 'anyof'
  | 'nallof'
  | 'nanyof'
  | 'is'
  | 'isnot';

/**
 * Filter logical operators
 */
export type FilterLogicalOp = 'and' | 'or' | 'not';

/**
 * Filter type definition
 */
export interface FilterType {
  id?: string;
  fk_column_id?: string;
  fk_parent_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
  comparison_op?: FilterComparisonOp;
  comparison_sub_op?: string;
  value?: any;
  logical_op?: FilterLogicalOp;
  is_group?: boolean;
  children?: FilterType[];
  order?: number;
}

// ========================================
// Sort Definitions
// ========================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort type definition
 */
export interface SortType {
  id?: string;
  fk_column_id: string;
  fk_view_id?: string;
  direction: SortDirection;
  order?: number;
}

// ========================================
// Query Arguments
// ========================================

/**
 * List query arguments
 */
export interface ListArgs {
  fields?: string | string[];
  where?: string;
  filterArr?: FilterType[];
  sortArr?: SortType[];
  limit?: number;
  offset?: number;
  sort?: string;
  pks?: string;
  condition?: Record<string, any>;
}

/**
 * GroupBy query arguments
 */
export interface GroupByArgs extends ListArgs {
  column_name: string;
  aggregation?: string;
}

/**
 * Child list arguments for relations
 */
export interface ChildListArgs {
  colId: string;
  parentRowId: string;
  childRowId?: string;
}

// ========================================
// Cookie/Context Types
// ========================================

/**
 * Cookie/Context for tracking user actions
 */
export interface CookieType {
  user?: {
    id?: string;
    email?: string;
    display_name?: string;
  };
  ip?: string;
  user_agent?: string;
  locale?: string;
}

// ========================================
// Response Types
// ========================================

/**
 * Generic record type
 */
export type RecordType = Record<string, any>;

/**
 * Bulk operation options
 */
export interface BulkOperationOptions {
  chunkSize?: number;
  cookie?: CookieType;
  trx?: Knex.Transaction;
  throwExceptionIfNotExist?: boolean;
  skipValidation?: boolean;
}

// ========================================
// System Column Names
// ========================================

/**
 * System column name mapping
 */
export const SystemColumnNames: Record<UITypes, string | null> = {
  [UITypes.ID]: 'id',
  [UITypes.CreatedTime]: 'created_at',
  [UITypes.LastModifiedTime]: 'updated_at',
  [UITypes.CreatedBy]: 'created_by',
  [UITypes.LastModifiedBy]: 'updated_by',
  [UITypes.SingleLineText]: null,
  [UITypes.LongText]: null,
  [UITypes.Number]: null,
  [UITypes.Decimal]: null,
  [UITypes.Currency]: null,
  [UITypes.Percent]: null,
  [UITypes.Rating]: null,
  [UITypes.Checkbox]: null,
  [UITypes.Date]: null,
  [UITypes.DateTime]: null,
  [UITypes.Time]: null,
  [UITypes.Duration]: null,
  [UITypes.Email]: null,
  [UITypes.PhoneNumber]: null,
  [UITypes.URL]: null,
  [UITypes.SingleSelect]: null,
  [UITypes.MultiSelect]: null,
  [UITypes.Attachment]: null,
  [UITypes.JSON]: null,
  [UITypes.Formula]: null,
  [UITypes.Rollup]: null,
  [UITypes.Lookup]: null,
  [UITypes.LinkToAnotherRecord]: null,
  [UITypes.Links]: null,
  [UITypes.User]: null,
  [UITypes.AutoNumber]: null,
  [UITypes.Barcode]: null,
  [UITypes.QrCode]: null,
  [UITypes.GeoData]: null,
  [UITypes.Geometry]: null,
  [UITypes.SpecificDBType]: null,
};

/**
 * System column UI types
 */
export const SystemColumnUITypes: UITypes[] = [
  UITypes.ID,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
];

/**
 * Virtual column UI types (computed, not stored directly)
 */
export const VirtualColumnUITypes: UITypes[] = [
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
];

/**
 * Default ID column definition
 */
export const ID_COLUMN: ColumnType = {
  id: '__nc_id__',
  title: 'Id',
  column_name: 'id',
  uidt: UITypes.ID,
  pk: true,
  system: true,
};

// ========================================
// Model Configuration
// ========================================

/**
 * Model configuration
 */
export interface ModelConfig {
  limitDefault: number;
  limitMin: number;
  limitMax: number;
}

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  limitDefault: 25,
  limitMin: 1,
  limitMax: 1000,
};
