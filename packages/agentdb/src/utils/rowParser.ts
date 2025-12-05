/**
 * Row parsing utilities
 * @module utils/rowParser
 */

import type { Record } from '../types';

/**
 * Parse a database row, extracting JSONB data and merging with system fields
 * This handles both string and object data formats from PostgreSQL
 */
export function parseRow<T extends Record = Record>(row: T): T {
  if (!row) return row;

  // Handle stringified JSONB data
  if (typeof row.data === 'string') {
    try {
      const data = JSON.parse(row.data);
      const { data: _, ...systemFields } = row;
      return { ...systemFields, ...data } as T;
    } catch {
      return row;
    }
  }

  // Handle already parsed JSONB object
  if (row.data && typeof row.data === 'object') {
    const { data, ...systemFields } = row;
    return { ...systemFields, ...(data as object) } as T;
  }

  return row;
}

/**
 * Parse multiple database rows
 */
export function parseRows<T extends Record = Record>(rows: T[]): T[] {
  return rows.map((row) => parseRow(row));
}
