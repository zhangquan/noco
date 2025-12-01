/**
 * Filter condition builder
 * @module query/conditionBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table, Filter, FilterOperator } from '../types';
import { UITypes } from '../types';
import { getColumnById, getColumnsWithPk, isVirtualColumn } from '../utils/columnUtils';
import { getColumnExpressionWithCast } from './sqlBuilder';

// ============================================================================
// Types
// ============================================================================

type ConditionFn = (qb: Knex.QueryBuilder) => void;

// ============================================================================
// Main Condition Builder
// ============================================================================

/**
 * Apply filter conditions to query builder
 */
export async function applyConditions(
  filters: Filter | Filter[],
  qb: Knex.QueryBuilder,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<void> {
  const filterArray = Array.isArray(filters) ? filters : [filters];

  if (filterArray.length === 0) {
    return;
  }

  const conditionFn = await parseConditions(filterArray, table, tables, db);
  conditionFn(qb);
}

/**
 * Parse conditions into a condition function
 */
async function parseConditions(
  conditions: Filter[],
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  const builders: ConditionFn[] = [];
  let logicalOp: 'and' | 'or' = 'and';

  for (const condition of conditions) {
    // Handle group conditions (nested)
    if (condition.is_group && condition.children) {
      const childBuilder = await parseConditions(condition.children, table, tables, db);
      builders.push((qb) => {
        qb.where(function () {
          childBuilder(this);
        });
      });
      logicalOp = (condition.logical_op as 'and' | 'or') || 'and';
      continue;
    }

    // Handle leaf conditions
    if (condition.fk_column_id && condition.comparison_op) {
      const builder = await parseLeafCondition(condition, table, tables, db);
      if (builder) {
        builders.push(builder);
      }
      logicalOp = (condition.logical_op as 'and' | 'or') || 'and';
    }
  }

  // Combine builders with logical operator
  return (qb: Knex.QueryBuilder) => {
    for (let i = 0; i < builders.length; i++) {
      const builder = builders[i];
      if (i === 0) {
        builder(qb);
      } else if (logicalOp === 'or') {
        qb.orWhere(function () {
          builder(this);
        });
      } else {
        qb.andWhere(function () {
          builder(this);
        });
      }
    }
  };
}

/**
 * Parse a single leaf condition
 */
async function parseLeafCondition(
  filter: Filter,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn | null> {
  const column = getColumnById(filter.fk_column_id!, table);
  if (!column) {
    return null;
  }

  if (isVirtualColumn(column)) {
    return parseVirtualColumnCondition(filter, column, table, tables, db);
  }

  return parseRegularCondition(filter, column, table, db);
}

// ============================================================================
// Regular Column Conditions
// ============================================================================

function parseRegularCondition(
  filter: Filter,
  column: Column,
  table: Table,
  db: Knex
): ConditionFn {
  const sqlColumn = getColumnExpressionWithCast(column, table);
  const op = filter.comparison_op!;
  const value = filter.value;

  return (qb: Knex.QueryBuilder) => {
    applyOperator(qb, db, sqlColumn, op, value, column);
  };
}

/**
 * Apply comparison operator to query builder
 */
function applyOperator(
  qb: Knex.QueryBuilder,
  db: Knex,
  columnExpr: string,
  op: FilterOperator,
  value: unknown,
  column: Column
): void {
  switch (op) {
    case 'eq':
      qb.whereRaw(`${columnExpr} = ?`, [value]);
      break;

    case 'neq':
      qb.whereRaw(`${columnExpr} != ?`, [value]);
      break;

    case 'lt':
      qb.whereRaw(`${columnExpr} < ?`, [value]);
      break;

    case 'lte':
      qb.whereRaw(`${columnExpr} <= ?`, [value]);
      break;

    case 'gt':
      qb.whereRaw(`${columnExpr} > ?`, [value]);
      break;

    case 'gte':
      qb.whereRaw(`${columnExpr} >= ?`, [value]);
      break;

    case 'like':
      qb.whereRaw(`${columnExpr} ILIKE ?`, [`%${value}%`]);
      break;

    case 'nlike':
      qb.whereRaw(`${columnExpr} NOT ILIKE ?`, [`%${value}%`]);
      break;

    case 'null':
    case 'is':
      qb.whereRaw(`${columnExpr} IS NULL`);
      break;

    case 'notnull':
    case 'isnot':
      qb.whereRaw(`${columnExpr} IS NOT NULL`);
      break;

    case 'empty':
      qb.where(function () {
        this.whereRaw(`${columnExpr} IS NULL`).orWhereRaw(`${columnExpr} = ''`);
      });
      break;

    case 'notempty':
      qb.whereRaw(`${columnExpr} IS NOT NULL`).whereRaw(`${columnExpr} != ''`);
      break;

    case 'in': {
      const inValues = Array.isArray(value)
        ? value
        : String(value).split(',').map((v) => v.trim());
      qb.whereRaw(`${columnExpr} = ANY(?)`, [inValues]);
      break;
    }

    case 'notin': {
      const notInValues = Array.isArray(value)
        ? value
        : String(value).split(',').map((v) => v.trim());
      qb.whereRaw(`${columnExpr} != ALL(?)`, [notInValues]);
      break;
    }

    case 'between':
      if (Array.isArray(value) && value.length >= 2) {
        qb.whereRaw(`${columnExpr} BETWEEN ? AND ?`, [value[0], value[1]]);
      }
      break;

    case 'notbetween':
      if (Array.isArray(value) && value.length >= 2) {
        qb.whereRaw(`${columnExpr} NOT BETWEEN ? AND ?`, [value[0], value[1]]);
      }
      break;

    case 'allof':
      if (column.uidt === UITypes.MultiSelect) {
        const allValues = Array.isArray(value)
          ? value
          : String(value).split(',').map((v) => v.trim());
        for (const v of allValues) {
          qb.whereRaw(`${columnExpr}::jsonb ? ?`, [v]);
        }
      }
      break;

    case 'anyof':
      if (column.uidt === UITypes.MultiSelect) {
        const anyValues = Array.isArray(value)
          ? value
          : String(value).split(',').map((v) => v.trim());
        qb.where(function () {
          for (const v of anyValues) {
            this.orWhereRaw(`${columnExpr}::jsonb ? ?`, [v]);
          }
        });
      }
      break;

    case 'nallof':
      if (column.uidt === UITypes.MultiSelect) {
        const nallValues = Array.isArray(value)
          ? value
          : String(value).split(',').map((v) => v.trim());
        qb.where(function () {
          for (const v of nallValues) {
            this.orWhereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
          }
        });
      }
      break;

    case 'nanyof':
      if (column.uidt === UITypes.MultiSelect) {
        const nanyValues = Array.isArray(value)
          ? value
          : String(value).split(',').map((v) => v.trim());
        for (const v of nanyValues) {
          qb.whereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
        }
      }
      break;

    default:
      qb.whereRaw(`${columnExpr} = ?`, [value]);
  }
}

// ============================================================================
// Virtual Column Conditions
// ============================================================================

async function parseVirtualColumnCondition(
  filter: Filter,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  switch (column.uidt) {
    case UITypes.Formula:
      return parseFormulaCondition(filter, column, table, tables, db);

    case UITypes.Rollup:
      return parseRollupCondition(filter, column, table, tables, db);

    case UITypes.Lookup:
      return parseLookupCondition(filter, column, table, tables, db);

    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
      return parseLinkCondition(filter, column, table, tables, db);

    default:
      return () => {};
  }
}

async function parseFormulaCondition(
  filter: Filter,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  const options = column.colOptions as { formula?: string };
  if (!options?.formula) {
    return () => {};
  }

  const { buildFormulaExpression } = await import('./formulaBuilder');
  const formulaExpr = await buildFormulaExpression(options.formula, table, tables, db);

  return (qb: Knex.QueryBuilder) => {
    applyOperator(qb, db, `(${formulaExpr})`, filter.comparison_op!, filter.value, column);
  };
}

async function parseRollupCondition(
  filter: Filter,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  const options = column.colOptions as {
    fk_relation_column_id?: string;
    fk_rollup_column_id?: string;
  };
  if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
    return () => {};
  }

  const { buildRollupSubquery } = await import('./rollupBuilder');
  const rollupSubQuery = await buildRollupSubquery({ column, table, tables, db });

  return (qb: Knex.QueryBuilder) => {
    applyOperator(
      qb,
      db,
      `(${rollupSubQuery.toQuery()})`,
      filter.comparison_op!,
      filter.value,
      column
    );
  };
}

async function parseLookupCondition(
  filter: Filter,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  const options = column.colOptions as {
    fk_relation_column_id?: string;
    fk_lookup_column_id?: string;
  };
  if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
    return () => {};
  }

  const { getColumnById } = await import('../utils/columnUtils');
  const { getTableByIdOrThrow } = await import('../utils/columnUtils');
  const { getColumnExpression, createQueryBuilder } = await import('./sqlBuilder');

  const relationColumn = getColumnById(options.fk_relation_column_id, table);
  if (!relationColumn) {
    return () => {};
  }

  const relationOptions = relationColumn.colOptions as { fk_related_model_id?: string };
  if (!relationOptions?.fk_related_model_id) {
    return () => {};
  }

  const relatedTable = getTableByIdOrThrow(relationOptions.fk_related_model_id, tables);
  const lookupColumn = getColumnById(options.fk_lookup_column_id, relatedTable);
  if (!lookupColumn) {
    return () => {};
  }

  const lookupSqlCol = getColumnExpression(lookupColumn, relatedTable, 'lookup_table');

  return (qb: Knex.QueryBuilder) => {
    const subQuery = createQueryBuilder(db, relatedTable, 'lookup_table')
      .select(db.raw(lookupSqlCol))
      .whereRaw(`lookup_table.id = nc_bigtable.data ->> ?`, [relationColumn.column_name]);

    applyOperator(qb, db, `(${subQuery.toQuery()})`, filter.comparison_op!, filter.value, column);
  };
}

async function parseLinkCondition(
  filter: Filter,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex
): Promise<ConditionFn> {
  const options = column.colOptions;
  if (!options) {
    return () => {};
  }

  const { buildLinkCountSubquery } = await import('./linkBuilder');
  const countSubQuery = buildLinkCountSubquery({
    modelId: table.id,
    column,
    tables,
    db,
  });

  return (qb: Knex.QueryBuilder) => {
    applyOperator(qb, db, `(${countSubQuery.toQuery()})`, filter.comparison_op!, filter.value, column);
  };
}

// ============================================================================
// Legacy Where String Parser
// ============================================================================

/**
 * Parse simple where string (legacy format)
 * Format: "field,op,value" or "(field,op,value)~and(field,op,value)"
 */
export function parseWhereString(whereStr: string, table: Table): Filter[] {
  if (!whereStr) {
    return [];
  }

  const filters: Filter[] = [];
  const columns = getColumnsWithPk(table);
  const parts = whereStr.split('~');

  for (const part of parts) {
    const match = part.match(/^\(?([\w]+),([\w]+),(.+?)\)?$/);
    if (match) {
      const [, fieldName, op, value] = match;
      const column = columns.find(
        (c) => c.column_name === fieldName || c.title === fieldName
      );

      if (column) {
        filters.push({
          fk_column_id: column.id,
          comparison_op: op as FilterOperator,
          value,
        });
      }
    }
  }

  return filters;
}
