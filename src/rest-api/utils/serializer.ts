/**
 * Data Serialization Utilities
 * @module rest-api/utils/serializer
 */

import type { Column, DataRecord } from '../../types';
import { UITypes, getColumnName } from '../../types';

/**
 * Serialize a cell value for export
 *
 * @param value - Raw value
 * @param column - Column definition
 * @returns Serialized value
 */
export function serializeCellValue(
  value: unknown,
  column: Column
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  const uidt = column.uidt as UITypes;

  switch (uidt) {
    case UITypes.Attachment:
    case UITypes.JSON:
      return typeof value === 'string' ? value : JSON.stringify(value);

    case UITypes.MultiSelect:
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    case UITypes.Checkbox:
      return Boolean(value);

    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.AutoNumber:
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      }
      return null;

    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        return (
          (obj.display_name as string) ||
          (obj.email as string) ||
          (obj.id as string) ||
          JSON.stringify(value)
        );
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Extract value from record by column
 *
 * @param record - Data record
 * @param column - Column definition
 * @returns Value from record
 */
export function getRecordValue(record: DataRecord, column: Column): unknown {
  const key = getColumnName(column);
  return (
    (record as Record<string, unknown>)[key] ??
    (record as Record<string, unknown>)[column.id] ??
    (record as Record<string, unknown>)[column.title]
  );
}

/**
 * Escape CSV value
 *
 * @param value - Value to escape
 * @returns Escaped CSV string
 */
export function escapeCsvValue(value: string | number | boolean | null): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build CSV data from records
 *
 * @param records - Data records
 * @param columns - Column definitions
 * @returns CSV string
 */
export function buildCsv(records: DataRecord[], columns: Column[]): string {
  // Build header row
  const headers = columns.map((c) => {
    const title = c.title || getColumnName(c);
    return escapeCsvValue(title);
  });

  // Build data rows
  const rows = records.map((record) =>
    columns
      .map((col) => {
        const value = getRecordValue(record, col);
        const serialized = serializeCellValue(value, col);
        return escapeCsvValue(serialized);
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Build data array for XLSX export
 *
 * @param records - Data records
 * @param columns - Column definitions
 * @returns Array of arrays (headers + rows)
 */
export function buildXlsxData(
  records: DataRecord[],
  columns: Column[]
): Array<Array<string | number | boolean | null>> {
  // Headers
  const headers = columns.map((c) => c.title || getColumnName(c));

  // Data rows
  const rows = records.map((record) =>
    columns.map((col) => {
      const value = getRecordValue(record, col);
      return serializeCellValue(value, col);
    })
  );

  return [headers, ...rows];
}

/**
 * Get columns for export (exclude virtual columns)
 *
 * @param columns - All columns
 * @param requestedFields - Requested field names
 * @returns Exportable columns
 */
export function getExportableColumns(
  columns: Column[],
  requestedFields?: string[]
): Column[] {
  // Filter out virtual columns
  const exportable = columns.filter((c) => {
    const uidt = c.uidt as UITypes;
    return ![
      UITypes.Formula,
      UITypes.Rollup,
      UITypes.Lookup,
      UITypes.Links,
      UITypes.LinkToAnotherRecord,
    ].includes(uidt);
  });

  // If specific fields requested, filter
  if (requestedFields && requestedFields.length > 0) {
    return exportable.filter(
      (c) =>
        requestedFields.includes(c.id) ||
        requestedFields.includes(c.title) ||
        requestedFields.includes(getColumnName(c))
    );
  }

  return exportable;
}
