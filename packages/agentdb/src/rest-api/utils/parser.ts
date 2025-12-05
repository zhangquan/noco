/**
 * Request Parameter Parser
 * @module rest-api/utils/parser
 */

import type { Filter, Sort, FilterOperator } from '../../types';
import type {
  ListParams,
  RawListQuery,
  GroupByParams,
  RawGroupByQuery,
  FilterObject,
  SortObject,
} from '../types';
import { getConfig } from '../config';
import { BadRequestError } from '../middleware';

/**
 * Parse list query parameters
 *
 * @param query - Raw query parameters
 * @returns Parsed list parameters
 */
export function parseListParams(query: RawListQuery): ListParams {
  const config = getConfig();
  const params: ListParams = {};

  // Parse pagination
  if (query.offset !== undefined) {
    params.offset = Math.max(0, parseInt(query.offset, 10) || 0);
  }

  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10) || config.defaultPageSize;
    params.limit = Math.min(Math.max(1, limit), config.maxPageSize);
  } else {
    params.limit = config.defaultPageSize;
  }

  // Parse fields
  if (query.fields) {
    params.fields = Array.isArray(query.fields)
      ? query.fields
      : query.fields.split(',').map((f) => f.trim()).filter(Boolean);
  }

  // Parse legacy where
  if (query.where) {
    params.where = query.where;
  }

  // Parse legacy sort
  if (query.sort) {
    params.sort = query.sort;
  }

  // Parse filter array (JSON)
  if (query.filterArrJson) {
    try {
      params.filterArr = JSON.parse(query.filterArrJson) as Filter[];
    } catch {
      throw new BadRequestError('Invalid filterArrJson format');
    }
  }

  // Parse sort array (JSON)
  if (query.sortArrJson) {
    try {
      params.sortArr = JSON.parse(query.sortArrJson) as Sort[];
    } catch {
      throw new BadRequestError('Invalid sortArrJson format');
    }
  }

  // Parse simplified filter (AI-friendly)
  if (query.filter) {
    try {
      params.filter =
        typeof query.filter === 'string'
          ? JSON.parse(query.filter)
          : query.filter;
    } catch {
      throw new BadRequestError('Invalid filter format');
    }
  }

  // Parse simplified sortBy (AI-friendly)
  if (query.sortBy) {
    try {
      params.sortBy =
        typeof query.sortBy === 'string'
          ? JSON.parse(query.sortBy)
          : query.sortBy;
    } catch {
      throw new BadRequestError('Invalid sortBy format');
    }
  }

  return params;
}

/**
 * Parse groupBy query parameters
 *
 * @param query - Raw query parameters
 * @param columnId - Column ID from route params
 * @returns Parsed groupBy parameters
 */
export function parseGroupByParams(
  query: RawGroupByQuery,
  columnId?: string
): GroupByParams {
  const listParams = parseListParams(query);
  const column = columnId || query.column_name;

  if (!column) {
    throw new BadRequestError('Column name is required for groupby');
  }

  return {
    ...listParams,
    columnId: column,
    aggregation: (query.aggregation as GroupByParams['aggregation']) || 'count',
  };
}

/**
 * Parse row IDs from request body or query
 *
 * @param body - Request body
 * @param queryIds - IDs from query string
 * @returns Array of row IDs
 */
export function parseRowIds(
  body: unknown,
  queryIds?: string
): string[] {
  // From body (array of objects with id, or array of strings)
  if (Array.isArray(body)) {
    return body
      .map((item) =>
        typeof item === 'string'
          ? item
          : (item as Record<string, unknown>)?.id ||
            (item as Record<string, unknown>)?.Id
      )
      .filter((id): id is string => Boolean(id));
  }

  // From query (comma-separated)
  if (queryIds) {
    return queryIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Parse fields string to array
 *
 * @param fields - Fields string or array
 * @returns Array of field names
 */
export function parseFields(fields?: string | string[]): string[] | undefined {
  if (!fields) return undefined;

  if (Array.isArray(fields)) {
    return fields;
  }

  return fields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Convert simplified filter to filter array
 *
 * @param filter - Simplified filter object
 * @returns Filter array
 */
export function filterObjectToArray(filter: FilterObject): Filter[] {
  const filters: Filter[] = [];

  for (const [field, value] of Object.entries(filter)) {
    if (value === null || value === undefined) continue;

    if (typeof value !== 'object' || value === null) {
      // Simple equality
      filters.push({
        fk_column_id: field,
        comparison_op: 'eq',
        value,
      });
    } else {
      // Complex filter
      const ops = value as Record<string, unknown>;

      for (const [op, val] of Object.entries(ops)) {
        let comparison_op: FilterOperator;

        switch (op) {
          case 'eq':
            comparison_op = 'eq';
            break;
          case 'ne':
            comparison_op = 'neq';
            break;
          case 'gt':
            comparison_op = 'gt';
            break;
          case 'gte':
            comparison_op = 'gte';
            break;
          case 'lt':
            comparison_op = 'lt';
            break;
          case 'lte':
            comparison_op = 'lte';
            break;
          case 'like':
            comparison_op = 'like';
            break;
          case 'nlike':
            comparison_op = 'nlike';
            break;
          case 'in':
            comparison_op = 'in';
            break;
          case 'notIn':
            comparison_op = 'notin';
            break;
          case 'isNull':
            comparison_op = val ? 'null' : 'notnull';
            break;
          case 'notNull':
            comparison_op = val ? 'notnull' : 'null';
            break;
          case 'contains':
            comparison_op = 'like';
            break;
          default:
            continue;
        }

        filters.push({
          fk_column_id: field,
          comparison_op,
          value: val,
        });
      }
    }
  }

  return filters;
}

/**
 * Convert simplified sortBy to sort array
 *
 * @param sortBy - Simplified sort object
 * @returns Sort array
 */
export function sortObjectToArray(sortBy: SortObject): Sort[] {
  return Object.entries(sortBy).map(([field, direction]) => ({
    fk_column_id: field,
    direction: direction === 'desc' ? 'desc' : 'asc',
  }));
}
