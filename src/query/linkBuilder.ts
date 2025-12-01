/**
 * Link count query builder
 * @module query/linkBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table, LinkColumnOption } from '../types';
import { RelationTypes } from '../types';
import { TABLE_DATA, TABLE_RELATIONS } from '../config';
import { getColumnById, getTableByIdOrThrow } from '../utils/columnUtils';

// ============================================================================
// Types
// ============================================================================

interface LinkCountParams {
  modelId: string;
  column: Column;
  tables: Table[];
  db: Knex;
  alias?: string;
}

// ============================================================================
// Main Link Count Builder
// ============================================================================

/**
 * Build subquery for link count
 */
export function buildLinkCountSubquery(
  params: LinkCountParams
): Knex.QueryBuilder | Knex.Raw {
  const { column, tables, db, alias } = params;

  const options = column.colOptions as LinkColumnOption;
  if (!options) {
    return db.raw('0');
  }

  const parentAlias = alias || 'nc_bigtable';

  switch (options.type) {
    case RelationTypes.MANY_TO_MANY:
      return buildMmLinkCount(options, tables, db, parentAlias);

    case RelationTypes.HAS_MANY:
      return buildHmLinkCount(options, column, tables, db, parentAlias);

    case RelationTypes.BELONGS_TO:
      return buildBtLinkCount(options, column, db, parentAlias);

    default:
      return db.raw('0');
  }
}

// ============================================================================
// Link Count Builders
// ============================================================================

function buildMmLinkCount(
  options: LinkColumnOption,
  tables: Table[],
  db: Knex,
  parentAlias: string
): Knex.QueryBuilder | Knex.Raw {
  const mmTableId = options.fk_mm_model_id || options.mm_model_id;
  if (!mmTableId) {
    return db.raw('0');
  }

  const mmTable = getTableByIdOrThrow(mmTableId, tables);

  return db(`${TABLE_RELATIONS} AS link_count`)
    .count('*')
    .where('link_count.fk_table_id', mmTable.id)
    .whereRaw(`link_count.fk_parent_id = ${parentAlias}.id`);
}

function buildHmLinkCount(
  options: LinkColumnOption,
  column: Column,
  tables: Table[],
  db: Knex,
  parentAlias: string
): Knex.QueryBuilder | Knex.Raw {
  const childTableId = options.fk_related_model_id;
  if (!childTableId) {
    return db.raw('0');
  }

  const childTable = getTableByIdOrThrow(childTableId, tables);

  let fkColumnName = 'fk_parent_id';
  if (options.fk_child_column_id) {
    const fkColumn = getColumnById(options.fk_child_column_id, childTable);
    if (fkColumn) {
      fkColumnName = fkColumn.column_name;
    }
  }

  return db(`${TABLE_DATA} AS link_count`)
    .count('*')
    .where('link_count.fk_table_id', childTable.id)
    .whereRaw(`link_count.data ->> '${fkColumnName}' = ${parentAlias}.id`);
}

function buildBtLinkCount(
  options: LinkColumnOption,
  column: Column,
  db: Knex,
  parentAlias: string
): Knex.Raw {
  const fkColumnName = column.column_name;

  return db.raw(
    `CASE WHEN ${parentAlias}.data ->> '${fkColumnName}' IS NOT NULL THEN 1 ELSE 0 END`
  );
}
