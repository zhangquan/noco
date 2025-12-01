/**
 * Sort builder
 * @module query/sortBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table, Sort, SortDirection } from '../types';
import { UITypes } from '../types';
import { getColumnById, isVirtualColumn } from '../utils/columnUtils';
import { getColumnExpressionWithCast, getColumnExpression, createQueryBuilder } from './sqlBuilder';

// ============================================================================
// Main Sort Builder
// ============================================================================

/**
 * Apply sorts to query builder
 */
export async function applySorts(
  sorts: Sort[],
  qb: Knex.QueryBuilder,
  table: Table,
  tables: Table[],
  db: Knex,
  alias?: string
): Promise<void> {
  if (!sorts || sorts.length === 0) {
    return;
  }

  for (const sort of sorts) {
    if (!sort.fk_column_id) {
      continue;
    }

    const column = getColumnById(sort.fk_column_id, table);
    if (!column) {
      continue;
    }

    const direction = sort.direction?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    if (isVirtualColumn(column)) {
      await applyVirtualSort(qb, column, table, tables, db, direction);
    } else {
      applyRegularSort(qb, column, table, db, direction, alias);
    }
  }
}

// ============================================================================
// Regular Column Sort
// ============================================================================

function applyRegularSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  db: Knex,
  direction: SortDirection,
  alias?: string
): void {
  const sqlColumn = getColumnExpressionWithCast(column, table, alias);

  if (direction === 'asc') {
    qb.orderByRaw(`${sqlColumn} ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`${sqlColumn} DESC NULLS FIRST`);
  }
}

// ============================================================================
// Virtual Column Sort
// ============================================================================

async function applyVirtualSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex,
  direction: SortDirection
): Promise<void> {
  switch (column.uidt) {
    case UITypes.Formula:
      await applyFormulaSort(qb, column, table, tables, db, direction);
      break;

    case UITypes.Rollup:
      await applyRollupSort(qb, column, table, tables, db, direction);
      break;

    case UITypes.Lookup:
      await applyLookupSort(qb, column, table, tables, db, direction);
      break;

    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
      await applyLinkSort(qb, column, table, tables, db, direction);
      break;
  }
}

async function applyFormulaSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex,
  direction: SortDirection
): Promise<void> {
  const options = column.colOptions as { formula?: string };
  if (!options?.formula) {
    return;
  }

  const { buildFormulaExpression } = await import('./formulaBuilder');
  const formulaExpr = await buildFormulaExpression(options.formula, table, tables, db);

  const nullOrder = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST';
  qb.orderByRaw(`(${formulaExpr}) ${direction.toUpperCase()} ${nullOrder}`);
}

async function applyRollupSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex,
  direction: SortDirection
): Promise<void> {
  const options = column.colOptions as {
    fk_relation_column_id?: string;
    fk_rollup_column_id?: string;
  };
  if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
    return;
  }

  const { buildRollupSubquery } = await import('./rollupBuilder');
  const rollupSubQuery = await buildRollupSubquery({ column, table, tables, db });

  const nullOrder = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST';
  qb.orderByRaw(`(${rollupSubQuery.toQuery()}) ${direction.toUpperCase()} ${nullOrder}`);
}

async function applyLookupSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex,
  direction: SortDirection
): Promise<void> {
  const options = column.colOptions as {
    fk_relation_column_id?: string;
    fk_lookup_column_id?: string;
  };
  if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
    return;
  }

  const relationColumn = getColumnById(options.fk_relation_column_id, table);
  if (!relationColumn) {
    return;
  }

  const relationOptions = relationColumn.colOptions as { fk_related_model_id?: string };
  if (!relationOptions?.fk_related_model_id) {
    return;
  }

  const { getTableByIdOrThrow } = await import('../utils/columnUtils');
  const relatedTable = getTableByIdOrThrow(tables, relationOptions.fk_related_model_id);
  const lookupColumn = getColumnById(options.fk_lookup_column_id, relatedTable);
  if (!lookupColumn) {
    return;
  }

  const lookupSqlCol = getColumnExpression(lookupColumn, relatedTable, 'sort_lookup');
  const subQuery = createQueryBuilder(db, relatedTable, 'sort_lookup')
    .select(db.raw(lookupSqlCol))
    .whereRaw(`sort_lookup.id = nc_bigtable.data ->> ?`, [relationColumn.column_name])
    .limit(1);

  const nullOrder = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST';
  qb.orderByRaw(`(${subQuery.toQuery()}) ${direction.toUpperCase()} ${nullOrder}`);
}

async function applyLinkSort(
  qb: Knex.QueryBuilder,
  column: Column,
  table: Table,
  tables: Table[],
  db: Knex,
  direction: SortDirection
): Promise<void> {
  const options = column.colOptions;
  if (!options) {
    return;
  }

  const { buildLinkCountSubquery } = await import('./linkBuilder');
  const countSubQuery = buildLinkCountSubquery({
    modelId: table.id,
    column,
    tables,
    db,
  });

  const nullOrder = direction === 'asc' ? 'NULLS LAST' : 'NULLS FIRST';
  qb.orderByRaw(`(${countSubQuery.toQuery()}) ${direction.toUpperCase()} ${nullOrder}`);
}

// ============================================================================
// Sort String Parser
// ============================================================================

/**
 * Parse sort string into Sort array
 * Format: "+field" or "-field" or "field:asc" or "field:desc"
 */
export function parseSortString(sortStr: string, table: Table): Sort[] {
  if (!sortStr) {
    return [];
  }

  const sorts: Sort[] = [];
  const columns = table.columns || [];
  const parts = sortStr.split(',');

  for (const part of parts) {
    let fieldName = part.trim();
    let direction: SortDirection = 'asc';

    if (fieldName.startsWith('-')) {
      direction = 'desc';
      fieldName = fieldName.slice(1);
    } else if (fieldName.startsWith('+')) {
      fieldName = fieldName.slice(1);
    }

    if (fieldName.includes(':')) {
      const [name, dir] = fieldName.split(':');
      fieldName = name;
      direction = dir?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    }

    const column = columns.find(
      (c) => c.column_name === fieldName || c.title === fieldName
    );

    if (column) {
      sorts.push({
        fk_column_id: column.id,
        direction,
      });
    }
  }

  return sorts;
}
