/**
 * Export Service
 * Business logic for data export operations
 * @module rest-api/services/ExportService
 */

import type { DataRecord, Column } from '../../types';
import { createModel } from '../../models/Model';
import { getColumnsWithPk } from '../../utils/columnUtils';
import type { RequestContext, ListParams, ExportResult } from '../types';
import { getConfig } from '../config';
import { buildCsv, buildXlsxData, getExportableColumns } from '../utils';

/**
 * Export Service
 * Handles CSV and Excel export operations
 */
export class ExportService {
  constructor(private ctx: RequestContext) {}

  /**
   * Export data as CSV
   */
  async exportCsv(
    params: ListParams,
    fields?: string[]
  ): Promise<{ filename: string; data: string; contentType: string }> {
    const { records, columns } = await this.fetchExportData(params, fields);

    const csvData = buildCsv(records, columns);
    const filename = this.generateFilename('csv');

    return {
      filename,
      data: csvData,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  /**
   * Export data as Excel (returns structured data)
   */
  async exportXlsx(
    params: ListParams,
    fields?: string[]
  ): Promise<ExportResult> {
    const { records, columns } = await this.fetchExportData(params, fields);

    const xlsxData = buildXlsxData(records, columns);
    const filename = this.generateFilename('xlsx');

    return {
      filename,
      format: 'xlsx',
      columns: xlsxData[0] as string[],
      rows: xlsxData.slice(1),
      totalRows: records.length,
    };
  }

  /**
   * Export with automatic format detection
   */
  async export(
    format: 'csv' | 'xlsx',
    params: ListParams,
    fields?: string[]
  ): Promise<
    | { filename: string; data: string; contentType: string }
    | ExportResult
  > {
    if (format === 'xlsx') {
      return this.exportXlsx(params, fields);
    }
    return this.exportCsv(params, fields);
  }

  /**
   * Fetch data for export in batches
   */
  private async fetchExportData(
    params: ListParams,
    fields?: string[]
  ): Promise<{ records: DataRecord[]; columns: Column[] }> {
    const config = getConfig();
    const model = this.createModel();

    // Get columns for export
    const allColumns = getColumnsWithPk(this.ctx.table!);
    const columns = getExportableColumns(allColumns, fields);
    const columnIds = columns.map((c) => c.id);

    // Fetch data in batches
    const records: DataRecord[] = [];
    const startTime = Date.now();
    let offset = 0;

    while (records.length < config.maxExportRows) {
      // Check timeout
      if (Date.now() - startTime > config.exportTimeout) {
        break;
      }

      const batchSize = Math.min(
        config.exportBatchSize,
        config.maxExportRows - records.length
      );

      const batch = await model.list({
        ...this.toListArgs(params),
        offset,
        limit: batchSize,
        fields: columnIds,
      });

      if (batch.length === 0) {
        break;
      }

      records.push(...batch);
      offset += batch.length;

      // If we got less than requested, we've reached the end
      if (batch.length < batchSize) {
        break;
      }
    }

    return { records, columns };
  }

  /**
   * Generate export filename
   */
  private generateFilename(extension: string): string {
    const tableName = this.ctx.table?.title || this.ctx.tableId || 'export';
    const timestamp = Date.now();
    return `${tableName}_${timestamp}.${extension}`;
  }

  /**
   * Create model instance
   */
  private createModel() {
    return createModel({
      db: this.ctx.db,
      tableId: this.ctx.tableId!,
      tables: this.ctx.tables,
      viewId: this.ctx.viewId,
    });
  }

  /**
   * Convert ListParams to ListArgs
   */
  private toListArgs(params: ListParams) {
    return {
      offset: params.offset,
      limit: params.limit,
      fields: params.fields,
      sort: params.sort,
      where: params.where,
      filterArr: params.filterArr,
      sortArr: params.sortArr,
      filter: params.filter,
      sortBy: params.sortBy,
    };
  }
}
