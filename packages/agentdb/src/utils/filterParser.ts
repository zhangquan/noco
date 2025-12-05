/**
 * Simplified filter and sort parser
 * Converts AI-friendly simplified syntax to internal format
 * @module utils/filterParser
 */

import type { Filter, Sort, SimpleFilter, SimpleFilterCondition, SimpleSort } from '../types';
import type { Table, Column } from '../types';
import { getColumnName } from '../types';

// ============================================================================
// Filter Parser
// ============================================================================

/**
 * Check if value is a SimpleFilterCondition object
 */
function isFilterCondition(value: unknown): value is SimpleFilterCondition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  
  const conditionKeys = [
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'nlike', 'in', 'notin', 'between',
    'null', 'notnull', 'empty', 'notempty',
    'contains', 'ncontains'
  ];
  
  return Object.keys(value).some((k) => conditionKeys.includes(k));
}

/**
 * Find column by ID, name, or title
 */
function findColumn(table: Table, key: string): Column | undefined {
  const columns = table.columns || [];
  return columns.find(
    (c) => c.id === key || c.title === key || getColumnName(c) === key
  );
}

/**
 * Convert SimpleFilterCondition to Filter array
 */
function conditionToFilters(columnId: string, condition: SimpleFilterCondition): Filter[] {
  const filters: Filter[] = [];
  
  if (condition.eq !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'eq', value: condition.eq });
  }
  if (condition.neq !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'neq', value: condition.neq });
  }
  if (condition.gt !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'gt', value: condition.gt });
  }
  if (condition.gte !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'gte', value: condition.gte });
  }
  if (condition.lt !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'lt', value: condition.lt });
  }
  if (condition.lte !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'lte', value: condition.lte });
  }
  if (condition.like !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'like', value: condition.like });
  }
  if (condition.nlike !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'nlike', value: condition.nlike });
  }
  if (condition.in !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'in', value: condition.in });
  }
  if (condition.notin !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'notin', value: condition.notin });
  }
  if (condition.between !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'between', value: condition.between });
  }
  if (condition.null === true) {
    filters.push({ fk_column_id: columnId, comparison_op: 'null' });
  }
  if (condition.notnull === true) {
    filters.push({ fk_column_id: columnId, comparison_op: 'notnull' });
  }
  if (condition.empty === true) {
    filters.push({ fk_column_id: columnId, comparison_op: 'empty' });
  }
  if (condition.notempty === true) {
    filters.push({ fk_column_id: columnId, comparison_op: 'notempty' });
  }
  if (condition.contains !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'anyof', value: condition.contains });
  }
  if (condition.ncontains !== undefined) {
    filters.push({ fk_column_id: columnId, comparison_op: 'nanyof', value: condition.ncontains });
  }
  
  return filters;
}

/**
 * Parse simplified filter to Filter array
 * 
 * @example
 * parseSimpleFilter({ status: 'active', age: { gte: 18 } }, table)
 * // Returns: [
 * //   { fk_column_id: 'status', comparison_op: 'eq', value: 'active' },
 * //   { fk_column_id: 'age', comparison_op: 'gte', value: 18 }
 * // ]
 */
export function parseSimpleFilter(filter: SimpleFilter, table: Table): Filter[] {
  const filters: Filter[] = [];
  
  for (const [key, value] of Object.entries(filter)) {
    // Find the column
    const column = findColumn(table, key);
    const columnId = column?.id || key;
    
    if (isFilterCondition(value)) {
      // Complex condition object
      filters.push(...conditionToFilters(columnId, value));
    } else {
      // Simple equality
      filters.push({
        fk_column_id: columnId,
        comparison_op: 'eq',
        value,
      });
    }
  }
  
  return filters;
}

// ============================================================================
// Sort Parser
// ============================================================================

/**
 * Parse simplified sort to Sort array
 * 
 * @example
 * parseSimpleSort({ created_at: 'desc', name: 'asc' }, table)
 * // Returns: [
 * //   { fk_column_id: 'created_at', direction: 'desc' },
 * //   { fk_column_id: 'name', direction: 'asc' }
 * // ]
 */
export function parseSimpleSort(sortBy: SimpleSort, table: Table): Sort[] {
  const sorts: Sort[] = [];
  
  for (const [key, direction] of Object.entries(sortBy)) {
    // Find the column
    const column = findColumn(table, key);
    const columnId = column?.id || key;
    
    sorts.push({
      fk_column_id: columnId,
      direction,
    });
  }
  
  return sorts;
}
