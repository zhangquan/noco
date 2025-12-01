import type { Knex } from 'knex';
import {
  ColumnType,
  SortType,
  TableType,
  UITypes,
  FormulaOptionType,
  RollupOptionType,
  LookupOptionType,
  LinkToAnotherRecordOptionType,
} from '../interface/types';
import {
  getColumnById,
  getSqlColumnName,
  getSqlColumnNameWithCast,
  isVirtualColumn,
  getTableByIdMust,
  getQueryBuilder,
} from './queryBuilderHelper';

// ========================================
// Main Sort Builder
// ========================================

/**
 * Apply sort to query builder (V2)
 * @param sortArr - Array of sorts
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 * @param modelAlias - Optional table alias
 */
export async function sortV2(
  sortArr: SortType[],
  qb: Knex.QueryBuilder,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  modelAlias?: string
): Promise<void> {
  if (!sortArr || sortArr.length === 0) {
    return;
  }

  for (const sort of sortArr) {
    if (!sort.fk_column_id) {
      continue;
    }

    const column = getColumnById(sort.fk_column_id, model);
    if (!column) {
      continue;
    }

    const direction = sort.direction?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Handle virtual columns
    if (isVirtualColumn(column)) {
      await applyVirtualColumnSort(qb, column, model, models, dbDriver, direction);
    } else {
      // Handle regular columns
      applyRegularColumnSort(qb, column, model, dbDriver, direction, modelAlias);
    }
  }
}

// ========================================
// Regular Column Sort
// ========================================

function applyRegularColumnSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  dbDriver: Knex,
  direction: 'asc' | 'desc',
  modelAlias?: string
): void {
  const sqlColumn = getSqlColumnNameWithCast(column, model, modelAlias);

  // Handle null sorting (nulls last for asc, nulls first for desc)
  if (direction === 'asc') {
    qb.orderByRaw(`${sqlColumn} ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`${sqlColumn} DESC NULLS FIRST`);
  }
}

// ========================================
// Virtual Column Sort
// ========================================

async function applyVirtualColumnSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  direction: 'asc' | 'desc'
): Promise<void> {
  switch (column.uidt) {
    case UITypes.Formula:
      await applyFormulaSort(qb, column, model, models, dbDriver, direction);
      break;

    case UITypes.Rollup:
      await applyRollupSort(qb, column, model, models, dbDriver, direction);
      break;

    case UITypes.Lookup:
      await applyLookupSort(qb, column, model, models, dbDriver, direction);
      break;

    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
      await applyLinkSort(qb, column, model, models, dbDriver, direction);
      break;

    default:
      // For other virtual columns, skip sorting
      break;
  }
}

/**
 * Apply formula column sort
 */
async function applyFormulaSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  direction: 'asc' | 'desc'
): Promise<void> {
  const options = column.colOptions as FormulaOptionType;
  if (!options?.formula) {
    return;
  }

  const { formulaQueryBuilderV2 } = await import('../queryBuilder/formulaQueryBuilderV2');
  const formulaExpr = await formulaQueryBuilderV2(options.formula, model, models, dbDriver);

  if (direction === 'asc') {
    qb.orderByRaw(`(${formulaExpr}) ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`(${formulaExpr}) DESC NULLS FIRST`);
  }
}

/**
 * Apply rollup column sort
 */
async function applyRollupSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  direction: 'asc' | 'desc'
): Promise<void> {
  const options = column.colOptions as RollupOptionType;
  if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
    return;
  }

  const { genRollupSelectV2 } = await import('../queryBuilder/genRollupSelectV2');
  const rollupSubQuery = await genRollupSelectV2({
    column,
    model,
    models,
    dbDriver,
  });

  if (direction === 'asc') {
    qb.orderByRaw(`(${rollupSubQuery.toQuery()}) ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`(${rollupSubQuery.toQuery()}) DESC NULLS FIRST`);
  }
}

/**
 * Apply lookup column sort
 */
async function applyLookupSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  direction: 'asc' | 'desc'
): Promise<void> {
  const options = column.colOptions as LookupOptionType;
  if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
    return;
  }

  // Get relation column
  const relationColumn = getColumnById(options.fk_relation_column_id, model);
  if (!relationColumn) {
    return;
  }

  const relationOptions = relationColumn.colOptions as LinkToAnotherRecordOptionType;
  if (!relationOptions?.fk_related_model_id) {
    return;
  }

  // Get related table and lookup column
  const relatedTable = getTableByIdMust(relationOptions.fk_related_model_id, models);
  const lookupColumn = getColumnById(options.fk_lookup_column_id, relatedTable);
  if (!lookupColumn) {
    return;
  }

  // Build subquery for sorting
  const lookupSqlCol = getSqlColumnName(lookupColumn, relatedTable, 'sort_lookup');
  const subQuery = getQueryBuilder(dbDriver, relatedTable, 'sort_lookup')
    .select(dbDriver.raw(lookupSqlCol))
    .whereRaw(`sort_lookup.id = nc_bigtable.data ->> ?`, [relationColumn.column_name])
    .limit(1);

  if (direction === 'asc') {
    qb.orderByRaw(`(${subQuery.toQuery()}) ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`(${subQuery.toQuery()}) DESC NULLS FIRST`);
  }
}

/**
 * Apply link column sort (sort by link count)
 */
async function applyLinkSort(
  qb: Knex.QueryBuilder,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex,
  direction: 'asc' | 'desc'
): Promise<void> {
  const options = column.colOptions as LinkToAnotherRecordOptionType;
  if (!options) {
    return;
  }

  const { genLinkCountToSelect } = await import('../queryBuilder/genLinkCountToSelect');
  const countSubQuery = genLinkCountToSelect({
    modelId: model.id,
    column,
    models,
    dbDriver,
  });

  if (direction === 'asc') {
    qb.orderByRaw(`(${countSubQuery.toQuery()}) ASC NULLS LAST`);
  } else {
    qb.orderByRaw(`(${countSubQuery.toQuery()}) DESC NULLS FIRST`);
  }
}

// ========================================
// Sort String Parser
// ========================================

/**
 * Parse sort string into SortType array
 * Format: "+field" or "-field" or "field:asc" or "field:desc"
 */
export function parseSortString(sortStr: string, model: TableType): SortType[] {
  if (!sortStr) {
    return [];
  }

  const sorts: SortType[] = [];
  const columns = model.columns || [];

  const parts = sortStr.split(',');

  for (const part of parts) {
    let fieldName = part.trim();
    let direction: 'asc' | 'desc' = 'asc';

    // Handle +/- prefix
    if (fieldName.startsWith('-')) {
      direction = 'desc';
      fieldName = fieldName.slice(1);
    } else if (fieldName.startsWith('+')) {
      direction = 'asc';
      fieldName = fieldName.slice(1);
    }

    // Handle :asc/:desc suffix
    if (fieldName.includes(':')) {
      const [name, dir] = fieldName.split(':');
      fieldName = name;
      direction = dir?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    }

    // Find column
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
