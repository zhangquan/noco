/**
 * Query Parameter Type Definitions
 * @module rest-api/types/params
 */

import type { Filter, Sort } from '../../types';

/**
 * Filter value for simplified filter syntax
 */
export type FilterValue =
  | string
  | number
  | boolean
  | null
  | {
      eq?: unknown;
      ne?: unknown;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      like?: string;
      nlike?: string;
      in?: unknown[];
      notIn?: unknown[];
      isNull?: boolean;
      notNull?: boolean;
      contains?: unknown;
    };

/**
 * Simplified filter object (AI-friendly)
 */
export interface FilterObject {
  [field: string]: FilterValue;
}

/**
 * Simplified sort object (AI-friendly)
 */
export interface SortObject {
  [field: string]: 'asc' | 'desc';
}

/**
 * List query parameters
 */
export interface ListParams {
  /** Page offset (0-based) */
  offset?: number;
  /** Page size */
  limit?: number;
  /** Fields to return */
  fields?: string[];
  /** Sort string (e.g., "-created_at,name") */
  sort?: string;
  /** Legacy where clause */
  where?: string;
  /** Filter array (legacy format) */
  filterArr?: Filter[];
  /** Sort array (legacy format) */
  sortArr?: Sort[];
  /** Simplified filter object */
  filter?: FilterObject;
  /** Simplified sort object */
  sortBy?: SortObject;
  /** Parent ID for relation queries */
  parentId?: string;
}

/**
 * Raw list query parameters (from request.query)
 */
export interface RawListQuery {
  offset?: string;
  limit?: string;
  fields?: string | string[];
  sort?: string;
  where?: string;
  filterArrJson?: string;
  sortArrJson?: string;
  filter?: string;
  sortBy?: string;
}

/**
 * GroupBy query parameters
 */
export interface GroupByParams extends ListParams {
  /** Column to group by */
  columnId: string;
  /** Aggregation function */
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

/**
 * Raw groupBy query parameters
 */
export interface RawGroupByQuery extends RawListQuery {
  column_name?: string;
  aggregation?: string;
}

/**
 * Export query parameters
 */
export interface ExportParams {
  /** Fields to export */
  fields?: string[];
  /** Export format */
  format?: 'csv' | 'xlsx';
  /** Filter conditions */
  filter?: FilterObject;
  /** Sort order */
  sortBy?: SortObject;
}

/**
 * Raw export query parameters
 */
export interface RawExportQuery {
  fields?: string | string[];
  format?: string;
  filter?: string;
  sortBy?: string;
}

/**
 * Bulk operation item
 */
export interface BulkWriteItem {
  /** Operation type */
  op: 'insert' | 'update' | 'delete' | 'link' | 'unlink';
  /** Record data (for insert/update) */
  data?: Record<string, unknown>;
  /** Record ID (for update/delete) */
  id?: string;
  /** Column ID (for link/unlink) */
  columnId?: string;
  /** Parent ID (for link/unlink) */
  parentId?: string;
  /** Child IDs (for link/unlink) */
  childIds?: string[];
}
