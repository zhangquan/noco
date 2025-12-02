/**
 * Type definitions barrel export
 * @module types
 */

// Column types
export {
  UITypes,
  RelationTypes,
  SYSTEM_COLUMN_TYPES,
  VIRTUAL_COLUMN_TYPES,
  SYSTEM_COLUMN_NAMES,
  DEFAULT_ID_COLUMN,
  getColumnName,
} from './column';

export type {
  Column,
  ColumnOption,
  BaseColumnOption,
  LinkColumnOption,
  FormulaColumnOption,
  RollupColumnOption,
  LookupColumnOption,
  SelectOption,
  RollupFunction,
} from './column';

// Table types
export { ViewTypes } from './table';
export type { Table, View, ViewLockType, LegacyTable } from './table';

// Filter and sort types
export type {
  Filter,
  Sort,
  FilterOperator,
  LogicalOperator,
  SortDirection,
} from './filter';

// Query types
export type {
  ListArgs,
  GroupByArgs,
  ChildListArgs,
  BulkOptions,
  RequestContext,
  RequestUser,
  DataRecord,
} from './query';

// Re-export DataRecord as Record for convenience
export type { DataRecord as Record } from './query';
