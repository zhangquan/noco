/**
 * Column utility functions
 * @module utils/columnUtils
 */

import type { Column, Table } from '../types';
import {
  UITypes,
  SYSTEM_COLUMN_TYPES,
  VIRTUAL_COLUMN_TYPES,
  SYSTEM_COLUMN_NAMES,
  DEFAULT_ID_COLUMN,
} from '../types';

// ============================================================================
// Column Type Checks
// ============================================================================

/**
 * Check if a column is a system column
 */
export function isSystemColumn(column: Column): boolean {
  return (
    column.system === true ||
    SYSTEM_COLUMN_TYPES.includes(column.uidt) ||
    column.uidt === UITypes.ID
  );
}

/**
 * Check if a column is a virtual column (computed)
 */
export function isVirtualColumn(column: Column): boolean {
  return VIRTUAL_COLUMN_TYPES.includes(column.uidt);
}

/**
 * Get system column name for a UI type
 */
export function getSystemColumnName(uidt: UITypes): string | undefined {
  return SYSTEM_COLUMN_NAMES[uidt];
}

// ============================================================================
// Column Access
// ============================================================================

/**
 * Get columns from a table
 */
export function getColumns(table: Table): Column[] {
  return table.columns || [];
}

/**
 * Get columns including default PK if not defined
 */
export function getColumnsWithPk(table: Table): Column[] {
  const columns = getColumns(table);
  const pk = getPrimaryKey(table);
  return pk ? columns : [DEFAULT_ID_COLUMN, ...columns];
}

/**
 * Get primary key column
 */
export function getPrimaryKey(table: Table): Column | undefined {
  return getColumns(table).find((col) => col.pk);
}

/**
 * Get primary key column (throws if not found)
 */
export function getPrimaryKeyOrDefault(table: Table): Column {
  return getPrimaryKey(table) || DEFAULT_ID_COLUMN;
}

/**
 * Get column by ID
 */
export function getColumnById(columnId: string, table: Table): Column | undefined {
  return getColumnsWithPk(table).find((col) => col.id === columnId);
}

/**
 * Get column by name or title
 */
export function getColumnByName(columnName: string, table: Table): Column | undefined {
  return getColumnsWithPk(table).find(
    (col) => col.column_name === columnName || col.title === columnName
  );
}

// ============================================================================
// Table Access
// ============================================================================

/**
 * Get table by ID
 */
export function getTableById(tableId: string, tables: Table[]): Table | undefined {
  return tables.find((t) => t.id === tableId);
}

/**
 * Get table by ID (throws if not found)
 */
export function getTableByIdOrThrow(tables: Table[], tableId: string): Table {
  const table = getTableById(tableId, tables);
  if (!table) {
    throw new Error(`Table '${tableId}' not found`);
  }
  return table;
}

/**
 * Get column by ID (throws if not found)
 */
export function getColumnByIdOrThrow(columnId: string, table: Table): Column {
  const column = getColumnById(columnId, table);
  if (!column) {
    throw new Error(`Column '${columnId}' not found`);
  }
  return column;
}

// ============================================================================
// Field Parsing
// ============================================================================

/**
 * Parse fields argument into column array
 */
export function parseFields(
  fields: string | string[] | undefined,
  table: Table
): Column[] {
  const allColumns = getColumnsWithPk(table);

  if (!fields) {
    return allColumns;
  }

  const fieldList = Array.isArray(fields)
    ? fields
    : fields.split(',').map((f) => f.trim());

  if (fieldList.length === 0 || (fieldList.length === 1 && fieldList[0] === '*')) {
    return allColumns;
  }

  return allColumns.filter(
    (col) =>
      fieldList.includes(col.id) ||
      fieldList.includes(col.title) ||
      fieldList.includes(col.column_name)
  );
}
