import type { Knex } from 'knex';
import {
  ColumnType,
  TableType,
  LinkToAnotherRecordOptionType,
  RelationTypes,
} from '../interface/types';
import {
  getColumnById,
  getTableByIdMust,
  NC_BIGTABLE,
  NC_BIGTABLE_RELATIONS,
} from '../helpers/queryBuilderHelper';

// ========================================
// Types
// ========================================

interface GenLinkCountParams {
  modelId: string;
  column: ColumnType;
  models: TableType[];
  dbDriver: Knex;
  alias?: string;
}

// ========================================
// Main Function
// ========================================

/**
 * Generate subquery for link count (Links column)
 * @param params - Parameters for link count generation
 * @returns Knex subquery or raw expression
 */
export function genLinkCountToSelect(
  params: GenLinkCountParams
): Knex.QueryBuilder | Knex.Raw {
  const { modelId, column, models, dbDriver, alias } = params;

  const linkOptions = column.colOptions as LinkToAnotherRecordOptionType;
  if (!linkOptions) {
    return dbDriver.raw('0');
  }

  const parentAlias = alias || 'nc_bigtable';

  switch (linkOptions.type) {
    case RelationTypes.MANY_TO_MANY:
      return buildMmLinkCount(linkOptions, models, dbDriver, parentAlias);

    case RelationTypes.HAS_MANY:
      return buildHmLinkCount(linkOptions, column, models, dbDriver, parentAlias);

    case RelationTypes.BELONGS_TO:
      return buildBtLinkCount(linkOptions, column, models, dbDriver, parentAlias);

    default:
      return dbDriver.raw('0');
  }
}

// ========================================
// Link Count Builders
// ========================================

/**
 * Build MM (Many-to-Many) link count subquery
 */
function buildMmLinkCount(
  linkOptions: LinkToAnotherRecordOptionType,
  models: TableType[],
  dbDriver: Knex,
  parentAlias: string
): Knex.QueryBuilder | Knex.Raw {
  const mmTableId = linkOptions.fk_mm_model_id || linkOptions.mm_model_id;
  if (!mmTableId) {
    return dbDriver.raw('0');
  }

  const mmTable = getTableByIdMust(mmTableId, models);

  // Count records in junction table
  const subquery = dbDriver(NC_BIGTABLE_RELATIONS + ' AS link_count')
    .count('*')
    .where('link_count.fk_table_id', mmTable.id)
    .whereRaw(`link_count.fk_parent_id = ${parentAlias}.id`);

  return subquery;
}

/**
 * Build HM (Has Many) link count subquery
 */
function buildHmLinkCount(
  linkOptions: LinkToAnotherRecordOptionType,
  column: ColumnType,
  models: TableType[],
  dbDriver: Knex,
  parentAlias: string
): Knex.QueryBuilder | Knex.Raw {
  const childTableId = linkOptions.fk_related_model_id;
  if (!childTableId) {
    return dbDriver.raw('0');
  }

  const childTable = getTableByIdMust(childTableId, models);

  // Get the FK column in child table
  let fkColumnName = 'fk_parent_id';
  if (linkOptions.fk_child_column_id) {
    const fkColumn = getColumnById(linkOptions.fk_child_column_id, childTable);
    if (fkColumn) {
      fkColumnName = fkColumn.column_name;
    }
  }

  // Count child records
  const subquery = dbDriver(NC_BIGTABLE + ' AS link_count')
    .count('*')
    .where('link_count.fk_table_id', childTable.id)
    .whereRaw(`link_count.data ->> '${fkColumnName}' = ${parentAlias}.id`);

  return subquery;
}

/**
 * Build BT (Belongs To) link count subquery
 * For BT, count is always 0 or 1 (has reference or not)
 */
function buildBtLinkCount(
  linkOptions: LinkToAnotherRecordOptionType,
  column: ColumnType,
  models: TableType[],
  dbDriver: Knex,
  parentAlias: string
): Knex.Raw {
  const fkColumnName = column.column_name;

  // Return 1 if FK is not null, 0 otherwise
  return dbDriver.raw(
    `CASE WHEN ${parentAlias}.data ->> '${fkColumnName}' IS NOT NULL THEN 1 ELSE 0 END`
  );
}
