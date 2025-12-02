/**
 * Rollup query builder
 * @module query/rollupBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table, RollupFunction, RollupColumnOption, LinkColumnOption } from '../types';
import { RelationTypes } from '../types';
import { TABLE_DATA, TABLE_RELATIONS } from '../config';
import { getColumnById, getTableByIdOrThrow } from '../utils/columnUtils';
import { getColumnExpressionWithCast } from './sqlBuilder';

// ============================================================================
// Types
// ============================================================================

interface RollupParams {
  column: Column;
  table: Table;
  tables: Table[];
  db: Knex;
  alias?: string;
}

// ============================================================================
// Main Rollup Builder
// ============================================================================

/**
 * Build subquery for rollup column
 */
export async function buildRollupSubquery(
  params: RollupParams
): Promise<Knex.QueryBuilder | Knex.Raw> {
  const { column, table, tables, db, alias } = params;

  const options = column.colOptions as RollupColumnOption;
  if (!options) {
    return db.raw('NULL');
  }

  const {
    fk_relation_column_id,
    fk_rollup_column_id,
    rollup_function = 'count',
  } = options;

  if (!fk_relation_column_id || !fk_rollup_column_id) {
    return db.raw('NULL');
  }

  const relationColumn = getColumnById(fk_relation_column_id, table);
  if (!relationColumn) {
    return db.raw('NULL');
  }

  const relationOptions = relationColumn.colOptions as LinkColumnOption;
  if (!relationOptions) {
    return db.raw('NULL');
  }

  const relatedTableId = relationOptions.fk_related_model_id;
  if (!relatedTableId) {
    return db.raw('NULL');
  }

  const relatedTable = getTableByIdOrThrow(tables, relatedTableId);
  const rollupColumn = getColumnById(fk_rollup_column_id, relatedTable);
  if (!rollupColumn) {
    return db.raw('NULL');
  }

  const rollupSqlCol = getColumnExpressionWithCast(rollupColumn, relatedTable, 'rollup_child');

  switch (relationOptions.type) {
    case RelationTypes.MANY_TO_MANY:
      return buildMmRollup(table, relatedTable, relationOptions, rollupSqlCol, rollup_function, tables, db, alias, relationColumn.id);

    case RelationTypes.HAS_MANY:
      return buildHmRollup(table, relatedTable, relationColumn, rollupSqlCol, rollup_function, db, alias);

    case RelationTypes.BELONGS_TO:
      return buildBtRollup(table, relatedTable, relationColumn, rollupSqlCol, rollup_function, db, alias);

    default:
      return db.raw('NULL');
  }
}

// ============================================================================
// Rollup Subquery Builders
// ============================================================================

function buildMmRollup(
  table: Table,
  relatedTable: Table,
  relationOptions: LinkColumnOption,
  rollupSqlCol: string,
  rollupFunction: RollupFunction,
  tables: Table[],
  db: Knex,
  alias?: string,
  relationColumnId?: string
): Knex.QueryBuilder | Knex.Raw {
  const parentAlias = alias || 'nc_bigtable';

  // Use the relation column ID to find linked children
  const columnId = relationColumnId || relationOptions.fk_mm_parent_column_id;
  if (!columnId) {
    return db.raw('NULL');
  }

  const childIdsSubquery = db(`${TABLE_RELATIONS} AS mm`)
    .select('mm.fk_child_id')
    .where('mm.fk_mm_parent_column_id', columnId)
    .whereRaw(`mm.fk_parent_id = ${parentAlias}.id`);

  return db(`${TABLE_DATA} AS rollup_child`)
    .select(db.raw(getAggregation(rollupFunction, rollupSqlCol)))
    .where('rollup_child.fk_table_id', relatedTable.id)
    .whereIn('rollup_child.id', childIdsSubquery);
}

function buildHmRollup(
  table: Table,
  relatedTable: Table,
  relationColumn: Column,
  rollupSqlCol: string,
  rollupFunction: RollupFunction,
  db: Knex,
  alias?: string
): Knex.QueryBuilder {
  const parentAlias = alias || 'nc_bigtable';
  const relationOptions = relationColumn.colOptions as LinkColumnOption;

  let fkColumnName = 'fk_parent_id';
  if (relationOptions.fk_child_column_id) {
    const fkColumn = getColumnById(relationOptions.fk_child_column_id, relatedTable);
    if (fkColumn) {
      fkColumnName = fkColumn.column_name;
    }
  }

  return db(`${TABLE_DATA} AS rollup_child`)
    .select(db.raw(getAggregation(rollupFunction, rollupSqlCol)))
    .where('rollup_child.fk_table_id', relatedTable.id)
    .whereRaw(`rollup_child.data ->> '${fkColumnName}' = ${parentAlias}.id`);
}

function buildBtRollup(
  table: Table,
  relatedTable: Table,
  relationColumn: Column,
  rollupSqlCol: string,
  rollupFunction: RollupFunction,
  db: Knex,
  alias?: string
): Knex.QueryBuilder {
  const parentAlias = alias || 'nc_bigtable';
  const fkColumnName = relationColumn.column_name;

  return db(`${TABLE_DATA} AS rollup_child`)
    .select(db.raw(getAggregation(rollupFunction, rollupSqlCol)))
    .where('rollup_child.fk_table_id', relatedTable.id)
    .whereRaw(`rollup_child.id = ${parentAlias}.data ->> '${fkColumnName}'`);
}

// ============================================================================
// Aggregation Helpers
// ============================================================================

function getAggregation(rollupFunction: RollupFunction, columnExpr: string): string {
  switch (rollupFunction) {
    case 'count':
      return 'COUNT(*)';
    case 'sum':
      return `COALESCE(SUM(${columnExpr}::NUMERIC), 0)`;
    case 'avg':
      return `AVG(${columnExpr}::NUMERIC)`;
    case 'min':
      return `MIN(${columnExpr})`;
    case 'max':
      return `MAX(${columnExpr})`;
    case 'countEmpty':
      return `COUNT(*) FILTER (WHERE ${columnExpr} IS NULL OR ${columnExpr} = '')`;
    case 'countNotEmpty':
      return `COUNT(*) FILTER (WHERE ${columnExpr} IS NOT NULL AND ${columnExpr} != '')`;
    case 'countDistinct':
      return `COUNT(DISTINCT ${columnExpr})`;
    case 'sumDistinct':
      return `COALESCE(SUM(DISTINCT ${columnExpr}::NUMERIC), 0)`;
    case 'avgDistinct':
      return `AVG(DISTINCT ${columnExpr}::NUMERIC)`;
    default:
      return 'COUNT(*)';
  }
}
