/**
 * Link count query builder
 * @module query/linkBuilder
 */

import type { Knex } from 'knex';
import type { Column, Table, LinkColumnOption } from '../types';
import { RelationTypes, getColumnName } from '../types';
import { TABLE_DATA, TABLE_LINKS } from '../config';
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

  const parentAlias = alias || TABLE_DATA;

  switch (options.type) {
    case RelationTypes.MANY_TO_MANY:
      return buildMmLinkCount(options, column.id, db, parentAlias);

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
  columnId: string,
  db: Knex,
  parentAlias: string
): Knex.QueryBuilder | Knex.Raw {
  // Use the column ID to count links for this specific relation
  return db(`${TABLE_LINKS} AS link_count`)
    .count('*')
    .where('link_count.link_field_id', columnId)
    .whereRaw(`link_count.source_record_id = ${parentAlias}.id`);
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

  const childTable = getTableByIdOrThrow(tables, childTableId);

  let fkColName = 'fk_parent_id';
  if (options.fk_child_column_id) {
    const fkColumn = getColumnById(options.fk_child_column_id, childTable);
    if (fkColumn) {
      fkColName = getColumnName(fkColumn);
    }
  }

  return db(`${TABLE_DATA} AS link_count`)
    .count('*')
    .where('link_count.table_id', childTable.id)
    .whereRaw(`link_count.data ->> '${fkColName}' = ${parentAlias}.id`);
}

function buildBtLinkCount(
  options: LinkColumnOption,
  column: Column,
  db: Knex,
  parentAlias: string
): Knex.Raw {
  const fkColName = getColumnName(column);

  return db.raw(
    `CASE WHEN ${parentAlias}.data ->> '${fkColName}' IS NOT NULL THEN 1 ELSE 0 END`
  );
}
