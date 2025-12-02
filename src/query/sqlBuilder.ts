/**
 * SQL query building utilities
 * @module query/sqlBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table } from '../types';
import { UITypes, getColumnName } from '../types';
import { TABLE_DATA, TABLE_LINKS, ModelConfig, DEFAULT_MODEL_CONFIG } from '../config';
import {
  isSystemColumn,
  isVirtualColumn,
  getSystemColumnName,
  getColumnsWithPk,
  getPrimaryKeyOrDefault,
} from '../utils/columnUtils';

// ============================================================================
// Table Name Helpers
// ============================================================================

/**
 * Get SQL table name for a table
 */
export function getTableName(table: Table, alias?: string): string {
  return table.mm ? (alias || TABLE_LINKS) : (alias || TABLE_DATA);
}

/**
 * Get table with alias for Knex
 */
export function getTableWithAlias(table: Table, alias: string): Record<string, string> {
  return { [alias]: getTableName(table) };
}

// ============================================================================
// Column SQL Expressions
// ============================================================================

/**
 * Sanitize column name for SQL (prevent SQL injection)
 * Exported for use in other query builders
 */
export function sanitizeColumnName(name: string): string {
  // Only allow alphanumeric, underscore, and dash
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ModelError } = require('../core/NcError');
    throw new ModelError(`Invalid column name: ${name}`, 'BAD_REQUEST', { columnName: name });
  }
  return name;
}

/**
 * Sanitize alias/identifier for SQL
 */
export function sanitizeIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ModelError } = require('../core/NcError');
    throw new ModelError(`Invalid SQL identifier: ${identifier}`, 'BAD_REQUEST', { identifier });
  }
  return identifier;
}

/**
 * Get SQL column expression
 */
export function getColumnExpression(
  column: Column,
  table: Table,
  alias?: string
): string {
  const prefix = alias || getTableName(table);
  const colName = getColumnName(column);
  const safeColumnName = sanitizeColumnName(colName);

  // System columns or relation table: direct access
  if (isSystemColumn(column) || table.mm) {
    const sysName = getSystemColumnName(column.uidt as UITypes);
    const columnName = sysName || safeColumnName;
    return `${prefix}."${columnName}"`;
  }

  // User columns: JSONB access with safe column name
  return `${prefix}.data ->> '${safeColumnName}'`;
}

/**
 * Get SQL column expression with type casting
 */
export function getColumnExpressionWithCast(
  column: Column,
  table: Table,
  alias?: string
): string {
  const baseExpr = getColumnExpression(column, table, alias);

  if (isSystemColumn(column) || table.mm) {
    return baseExpr;
  }

  // Cast based on column type using NULLIF to handle empty strings
  switch (column.uidt) {
    case UITypes.Number:
    case UITypes.AutoNumber:
    case UITypes.Rating:
      return `CAST(NULLIF(${baseExpr}, '') AS NUMERIC)`;

    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
      return `CAST(NULLIF(${baseExpr}, '') AS DECIMAL)`;

    case UITypes.Checkbox:
      return `CAST(NULLIF(${baseExpr}, '') AS BOOLEAN)`;

    case UITypes.Date:
      return `CAST(NULLIF(${baseExpr}, '') AS DATE)`;

    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return `CAST(NULLIF(${baseExpr}, '') AS TIMESTAMP)`;

    case UITypes.Time:
      return `CAST(NULLIF(${baseExpr}, '') AS TIME)`;

    default:
      return baseExpr;
  }
}

// ============================================================================
// Query Builder Factory
// ============================================================================

/**
 * Create a query builder for a table with table_id filter
 */
export function createQueryBuilder(
  db: Knex,
  table: Table,
  alias?: string
): Knex.QueryBuilder {
  const tableName = getTableName(table);

  const query = alias ? db({ [alias]: tableName }) : db(tableName);

  // Filter by table_id for data isolation
  const tableAlias = alias || tableName;
  query.where(`${tableAlias}.table_id`, table.id);

  return query;
}

/**
 * Create an insert query builder (no table_id filter)
 */
export function createInsertBuilder(db: Knex, table: Table): Knex.QueryBuilder {
  return db(getTableName(table));
}

// ============================================================================
// SELECT Building
// ============================================================================

/**
 * Build column SELECT expressions
 */
export function buildSelectExpressions(
  columns: Column[],
  table: Table,
  alias: string | undefined,
  db: Knex
): (string | Knex.Raw)[] {
  const selects: (string | Knex.Raw)[] = [];

  for (const column of columns) {
    if (isVirtualColumn(column)) {
      continue;
    }

    const sqlCol = getColumnExpression(column, table, alias);
    const displayName = column.title || column.column_name;

    if (isSystemColumn(column) || table.mm) {
      selects.push(`${sqlCol} as "${displayName}"`);
    } else {
      selects.push(db.raw(`${sqlCol} as ??`, [displayName]));
    }
  }

  return selects;
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Apply pagination to query builder
 */
export function applyPagination(
  qb: Knex.QueryBuilder,
  limit?: number,
  offset?: number,
  config: ModelConfig = DEFAULT_MODEL_CONFIG
): void {
  const effectiveLimit = Math.min(
    Math.max(limit ?? config.limitDefault, config.limitMin),
    config.limitMax
  );
  qb.limit(effectiveLimit);

  if (offset !== undefined && offset > 0) {
    qb.offset(offset);
  }
}

// ============================================================================
// WHERE Clause Helpers
// ============================================================================

/**
 * Build WHERE clause for primary key
 */
export function buildPkWhere(
  table: Table,
  id: string,
  alias?: string
): Record<string, string> {
  const pk = getPrimaryKeyOrDefault(table);
  const prefix = alias || getTableName(table);
  const columnExpr = isSystemColumn(pk)
    ? `${prefix}.${pk.column_name}`
    : `${prefix}.id`;

  return { [columnExpr]: id };
}

// ============================================================================
// MM Relation Helpers
// ============================================================================

/**
 * Get related table ID from link column
 */
export function getChildTableIdFromMM(column: Column): string | null {
  if (!column.colOptions) return null;

  const options = typeof column.colOptions === 'string'
    ? JSON.parse(column.colOptions)
    : column.colOptions;

  return options?.fk_related_model_id || options?.fk_child_column_id || null;
}

/**
 * Get child table ID from MM junction table
 */
export function getChildTableIdFromMMTable(parentTableId: string, mmTable: Table): string {
  const columns = mmTable.columns || [];

  for (const col of columns) {
    if (col.uidt === UITypes.LinkToAnotherRecord && col.colOptions) {
      const options = col.colOptions as { fk_related_model_id?: string };
      if (options.fk_related_model_id && options.fk_related_model_id !== parentTableId) {
        return options.fk_related_model_id;
      }
    }
  }

  // Fallback: check for fk_child_id column
  const fkChildCol = columns.find((c) => c.column_name === 'fk_child_id');
  if (fkChildCol?.colOptions) {
    return (fkChildCol.colOptions as { fk_related_model_id?: string })?.fk_related_model_id || '';
  }

  return '';
}
