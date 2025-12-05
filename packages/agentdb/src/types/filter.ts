/**
 * Filter and Sort type definitions
 * @module types/filter
 */

// ============================================================================
// Simplified Filter Types (AI-friendly)
// ============================================================================

/**
 * Simplified filter condition for a single field
 * Examples:
 *   'active'                     -> equals 'active'
 *   { eq: 'active' }             -> equals 'active'
 *   { gte: 18, lt: 65 }          -> between 18 and 65
 *   { like: '%john%' }           -> contains 'john'
 *   { in: ['a', 'b'] }           -> in array
 */
export interface SimpleFilterCondition {
  eq?: unknown;
  neq?: unknown;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  like?: string;
  nlike?: string;
  in?: unknown[];
  notin?: unknown[];
  between?: [unknown, unknown];
  null?: boolean;
  notnull?: boolean;
  empty?: boolean;
  notempty?: boolean;
  contains?: unknown;        // for arrays/MultiSelect
  ncontains?: unknown;
}

/**
 * Simplified filter object
 * Keys are column IDs or titles, values are conditions
 * 
 * @example
 * {
 *   status: 'active',                    // equals
 *   age: { gte: 18, lt: 65 },            // range
 *   name: { like: '%john%' },            // contains
 *   tags: { contains: 'vip' }            // array contains
 * }
 */
export type SimpleFilter = {
  [columnId: string]: unknown | SimpleFilterCondition;
};

// ============================================================================
// Simplified Sort Types (AI-friendly)
// ============================================================================

/**
 * Simplified sort object
 * Keys are column IDs or titles, values are direction
 * 
 * @example
 * { created_at: 'desc', name: 'asc' }
 */
export type SimpleSort = {
  [columnId: string]: 'asc' | 'desc';
};

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filter comparison operators
 */
export type FilterOperator =
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
export type LogicalOperator = 'and' | 'or' | 'not';

/**
 * Filter definition
 */
export interface Filter {
  id?: string;
  fk_column_id?: string;
  fk_parent_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
  comparison_op?: FilterOperator;
  comparison_sub_op?: string;
  value?: unknown;
  logical_op?: LogicalOperator;
  is_group?: boolean;
  children?: Filter[];
  order?: number;
}

// ============================================================================
// Sort Types
// ============================================================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort definition
 */
export interface Sort {
  id?: string;
  fk_column_id: string;
  fk_view_id?: string;
  direction: SortDirection;
  order?: number;
}
