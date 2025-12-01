/**
 * Filter and Sort type definitions
 * @module types/filter
 */

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
