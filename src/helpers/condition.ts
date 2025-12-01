import type { Knex } from 'knex';
import {
  ColumnType,
  FilterType,
  TableType,
  UITypes,
  FilterComparisonOp,
  FilterLogicalOp,
  FormulaOptionType,
  RollupOptionType,
  LookupOptionType,
  LinkToAnotherRecordOptionType,
  RelationTypes,
} from '../interface/types';
import {
  getColumnById,
  getColumnsIncludingPk,
  getSqlColumnName,
  getSqlColumnNameWithCast,
  isVirtualColumn,
  getTableByIdMust,
  getQueryBuilder,
} from './queryBuilderHelper';

// ========================================
// Types
// ========================================

type ConditionBuilder = (qb: Knex.QueryBuilder) => void;

// ========================================
// Main Condition Builder
// ========================================

/**
 * Apply filter conditions to query builder (V2)
 * @param conditionObj - Filter or array of filters
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 */
export async function conditionV2(
  conditionObj: FilterType | FilterType[],
  qb: Knex.QueryBuilder,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<void> {
  const conditions = Array.isArray(conditionObj) ? conditionObj : [conditionObj];

  if (conditions.length === 0) {
    return;
  }

  const conditionFn = await parseConditionV2(conditions, model, models, dbDriver);
  conditionFn(qb);
}

/**
 * Parse conditions into a condition builder function
 */
async function parseConditionV2(
  conditions: FilterType[],
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  const builders: ConditionBuilder[] = [];
  let logicalOp: FilterLogicalOp = 'and';

  for (const condition of conditions) {
    // Handle group conditions (nested)
    if (condition.is_group && condition.children) {
      const childBuilder = await parseConditionV2(
        condition.children,
        model,
        models,
        dbDriver
      );
      builders.push((qb) => {
        qb.where(function () {
          childBuilder(this);
        });
      });
      logicalOp = condition.logical_op || 'and';
      continue;
    }

    // Handle leaf conditions
    if (condition.fk_column_id && condition.comparison_op) {
      const builder = await parseLeafCondition(condition, model, models, dbDriver);
      if (builder) {
        builders.push(builder);
      }
      logicalOp = condition.logical_op || 'and';
    }
  }

  // Combine all builders with logical operator
  return (qb: Knex.QueryBuilder) => {
    for (let i = 0; i < builders.length; i++) {
      const builder = builders[i];
      if (i === 0) {
        builder(qb);
      } else {
        if (logicalOp === 'or') {
          qb.orWhere(function () {
            builder(this);
          });
        } else {
          qb.andWhere(function () {
            builder(this);
          });
        }
      }
    }
  };
}

/**
 * Parse a single leaf condition
 */
async function parseLeafCondition(
  filter: FilterType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder | null> {
  const column = getColumnById(filter.fk_column_id!, model);
  if (!column) {
    return null;
  }

  // Handle virtual columns
  if (isVirtualColumn(column)) {
    return parseVirtualColumnCondition(filter, column, model, models, dbDriver);
  }

  // Handle regular columns
  return parseRegularColumnCondition(filter, column, model, dbDriver);
}

// ========================================
// Regular Column Conditions
// ========================================

function parseRegularColumnCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  dbDriver: Knex
): ConditionBuilder {
  const sqlColumn = getSqlColumnNameWithCast(column, model);
  const op = filter.comparison_op!;
  const value = filter.value;

  return (qb: Knex.QueryBuilder) => {
    applyComparisonOperator(qb, dbDriver, sqlColumn, op, value, column);
  };
}

/**
 * Apply comparison operator to query builder
 */
function applyComparisonOperator(
  qb: Knex.QueryBuilder,
  dbDriver: Knex,
  columnExpr: string,
  op: FilterComparisonOp,
  value: any,
  column: ColumnType
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
        this.whereRaw(`${columnExpr} IS NULL`)
          .orWhereRaw(`${columnExpr} = ''`);
      });
      break;

    case 'notempty':
      qb.whereRaw(`${columnExpr} IS NOT NULL`)
        .whereRaw(`${columnExpr} != ''`);
      break;

    case 'in':
      const inValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
      qb.whereRaw(`${columnExpr} = ANY(?)`, [inValues]);
      break;

    case 'notin':
      const notInValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
      qb.whereRaw(`${columnExpr} != ALL(?)`, [notInValues]);
      break;

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
      // For MultiSelect: all values must be present
      if (column.uidt === UITypes.MultiSelect) {
        const allValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
        for (const v of allValues) {
          qb.whereRaw(`${columnExpr}::jsonb ? ?`, [v]);
        }
      }
      break;

    case 'anyof':
      // For MultiSelect: any value must be present
      if (column.uidt === UITypes.MultiSelect) {
        const anyValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
        qb.where(function () {
          for (const v of anyValues) {
            this.orWhereRaw(`${columnExpr}::jsonb ? ?`, [v]);
          }
        });
      }
      break;

    case 'nallof':
      // For MultiSelect: not all values present
      if (column.uidt === UITypes.MultiSelect) {
        const nallValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
        qb.where(function () {
          for (const v of nallValues) {
            this.orWhereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
          }
        });
      }
      break;

    case 'nanyof':
      // For MultiSelect: none of the values present
      if (column.uidt === UITypes.MultiSelect) {
        const nanyValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
        for (const v of nanyValues) {
          qb.whereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
        }
      }
      break;

    default:
      // Default to equality
      qb.whereRaw(`${columnExpr} = ?`, [value]);
  }
}

// ========================================
// Virtual Column Conditions
// ========================================

async function parseVirtualColumnCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  switch (column.uidt) {
    case UITypes.Formula:
      return parseFormulaCondition(filter, column, model, models, dbDriver);

    case UITypes.Rollup:
      return parseRollupCondition(filter, column, model, models, dbDriver);

    case UITypes.Lookup:
      return parseLookupCondition(filter, column, model, models, dbDriver);

    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
      return parseLinkCondition(filter, column, model, models, dbDriver);

    default:
      return () => {};
  }
}

/**
 * Parse formula column condition
 */
async function parseFormulaCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  const options = column.colOptions as FormulaOptionType;
  if (!options?.formula) {
    return () => {};
  }

  // Import formula builder dynamically to avoid circular dependency
  const { formulaQueryBuilderV2 } = await import('../queryBuilder/formulaQueryBuilderV2');
  const formulaExpr = await formulaQueryBuilderV2(options.formula, model, models, dbDriver);

  return (qb: Knex.QueryBuilder) => {
    applyComparisonOperator(qb, dbDriver, `(${formulaExpr})`, filter.comparison_op!, filter.value, column);
  };
}

/**
 * Parse rollup column condition
 */
async function parseRollupCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  const options = column.colOptions as RollupOptionType;
  if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
    return () => {};
  }

  // Import rollup builder dynamically
  const { genRollupSelectV2 } = await import('../queryBuilder/genRollupSelectV2');
  const rollupSubQuery = await genRollupSelectV2({
    column,
    model,
    models,
    dbDriver,
  });

  return (qb: Knex.QueryBuilder) => {
    applyComparisonOperator(
      qb,
      dbDriver,
      `(${rollupSubQuery.toQuery()})`,
      filter.comparison_op!,
      filter.value,
      column
    );
  };
}

/**
 * Parse lookup column condition
 */
async function parseLookupCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  const options = column.colOptions as LookupOptionType;
  if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
    return () => {};
  }

  // Get relation column
  const relationColumn = getColumnById(options.fk_relation_column_id, model);
  if (!relationColumn) {
    return () => {};
  }

  const relationOptions = relationColumn.colOptions as LinkToAnotherRecordOptionType;
  if (!relationOptions?.fk_related_model_id) {
    return () => {};
  }

  // Get related table and lookup column
  const relatedTable = getTableByIdMust(relationOptions.fk_related_model_id, models);
  const lookupColumn = getColumnById(options.fk_lookup_column_id, relatedTable);
  if (!lookupColumn) {
    return () => {};
  }

  // Build subquery
  const lookupSqlCol = getSqlColumnName(lookupColumn, relatedTable, 'lookup_table');

  return (qb: Knex.QueryBuilder) => {
    const subQuery = getQueryBuilder(dbDriver, relatedTable, 'lookup_table')
      .select(dbDriver.raw(lookupSqlCol))
      .whereRaw(`lookup_table.id = nc_bigtable.data ->> ?`, [relationColumn.column_name]);

    applyComparisonOperator(
      qb,
      dbDriver,
      `(${subQuery.toQuery()})`,
      filter.comparison_op!,
      filter.value,
      column
    );
  };
}

/**
 * Parse link column condition (filter by link count)
 */
async function parseLinkCondition(
  filter: FilterType,
  column: ColumnType,
  model: TableType,
  models: TableType[],
  dbDriver: Knex
): Promise<ConditionBuilder> {
  const options = column.colOptions as LinkToAnotherRecordOptionType;
  if (!options) {
    return () => {};
  }

  // Import link count builder dynamically
  const { genLinkCountToSelect } = await import('../queryBuilder/genLinkCountToSelect');
  const countSubQuery = genLinkCountToSelect({
    modelId: model.id,
    column,
    models,
    dbDriver,
  });

  return (qb: Knex.QueryBuilder) => {
    applyComparisonOperator(
      qb,
      dbDriver,
      `(${countSubQuery.toQuery()})`,
      filter.comparison_op!,
      filter.value,
      column
    );
  };
}

// ========================================
// Legacy Condition Support
// ========================================

/**
 * Parse simple where string (legacy format)
 * Format: "field,op,value" or "(field,op,value)~and(field,op,value)"
 */
export function parseWhereString(
  whereStr: string,
  model: TableType
): FilterType[] {
  if (!whereStr) {
    return [];
  }

  const filters: FilterType[] = [];
  const columns = getColumnsIncludingPk(model);

  // Simple parsing - can be enhanced for complex expressions
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
          comparison_op: op as FilterComparisonOp,
          value: value,
        });
      }
    }
  }

  return filters;
}
