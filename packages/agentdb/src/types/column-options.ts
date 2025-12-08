/**
 * Column Option Type Definitions
 * Separated from column.ts for better organization
 * @module types/column-options
 */

import { RelationTypes } from './column';

// ============================================================================
// Base Option Type
// ============================================================================

/**
 * Base column option type
 */
export interface BaseColumnOption {
  /** Option record ID */
  id?: string;
  /** Reference to parent column */
  fk_column_id?: string;
}

// ============================================================================
// Link Column Options
// ============================================================================

/**
 * Link to another record column options
 */
export interface LinkColumnOptions extends BaseColumnOption {
  /** Relation type (hm, bt, mm) */
  type: RelationTypes;
  /** Related table ID */
  fk_related_model_id: string;
  /** Child column ID (for hm/bt) */
  fk_child_column_id?: string;
  /** Parent column ID (for hm/bt) */
  fk_parent_column_id?: string;
  /** Many-to-many junction table ID */
  fk_mm_model_id?: string;
  /** M2M junction table child column */
  fk_mm_child_column_id?: string;
  /** M2M junction table parent column */
  fk_mm_parent_column_id?: string;
  /** Symmetric column ID (for bidirectional links) */
  fk_symmetric_column_id?: string;
  /** Is virtual link (not backed by physical FK) */
  virtual?: boolean;
}

// ============================================================================
// Formula Column Options
// ============================================================================

/**
 * Formula column options
 */
export interface FormulaColumnOptions extends BaseColumnOption {
  /** Compiled formula expression */
  formula: string;
  /** Original formula string as entered by user */
  formula_raw?: string;
  /** Parsed AST tree (for formula validation) */
  parsed_tree?: unknown;
}

// ============================================================================
// Rollup Column Options
// ============================================================================

/**
 * Rollup aggregation function types
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
export interface RollupColumnOptions extends BaseColumnOption {
  /** Link column ID to rollup from */
  fk_relation_column_id: string;
  /** Related table ID (denormalized for performance) */
  fk_relation_table_id?: string;
  /** Column ID in related table to aggregate */
  fk_rollup_column_id: string;
  /** Aggregation function */
  rollup_function: RollupFunction;
}

// ============================================================================
// Lookup Column Options
// ============================================================================

/**
 * Lookup column options
 */
export interface LookupColumnOptions extends BaseColumnOption {
  /** Link column ID to lookup from */
  fk_relation_column_id: string;
  /** Column ID in related table to display */
  fk_lookup_column_id: string;
}

// ============================================================================
// Select Column Options
// ============================================================================

/**
 * Single option for SingleSelect/MultiSelect columns
 */
export interface SelectOption {
  /** Option ID */
  id: string;
  /** Display title */
  title: string;
  /** Display color (hex) */
  color?: string;
  /** Sort order */
  order?: number;
}

/**
 * Select column options (for SingleSelect/MultiSelect)
 */
export interface SelectColumnOptions {
  /** Available options */
  options: SelectOption[];
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * All possible column option types
 * Use type guards to narrow to specific type
 */
export type ColumnOptions =
  | LinkColumnOptions
  | FormulaColumnOptions
  | RollupColumnOptions
  | LookupColumnOptions
  | SelectColumnOptions;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if options are link column options
 */
export function isLinkColumnOptions(opts: unknown): opts is LinkColumnOptions {
  return (
    typeof opts === 'object' &&
    opts !== null &&
    'fk_related_model_id' in opts &&
    'type' in opts
  );
}

/**
 * Check if options are formula column options
 */
export function isFormulaColumnOptions(opts: unknown): opts is FormulaColumnOptions {
  return (
    typeof opts === 'object' &&
    opts !== null &&
    'formula' in opts
  );
}

/**
 * Check if options are rollup column options
 */
export function isRollupColumnOptions(opts: unknown): opts is RollupColumnOptions {
  return (
    typeof opts === 'object' &&
    opts !== null &&
    'fk_rollup_column_id' in opts &&
    'rollup_function' in opts
  );
}

/**
 * Check if options are lookup column options
 */
export function isLookupColumnOptions(opts: unknown): opts is LookupColumnOptions {
  return (
    typeof opts === 'object' &&
    opts !== null &&
    'fk_lookup_column_id' in opts &&
    !('rollup_function' in opts)
  );
}

/**
 * Check if options are select column options
 */
export function isSelectColumnOptions(opts: unknown): opts is SelectColumnOptions {
  return (
    typeof opts === 'object' &&
    opts !== null &&
    'options' in opts &&
    Array.isArray((opts as SelectColumnOptions).options)
  );
}
