/**
 * Bulk Service
 * Business logic for bulk operations
 * @module rest-api/services/BulkService
 */

import type { DataRecord, BulkWriteOperation } from '../../types';
import { createModel } from '../../models/Model';
import type { RequestContext, ListParams, BulkResult } from '../types';
import { getConfig } from '../config';
import { BadRequestError } from '../middleware';

/**
 * Bulk Service
 * Handles batch insert, update, delete operations
 */
export class BulkService {
  constructor(private ctx: RequestContext) {}

  /**
   * Bulk insert records
   */
  async bulkCreate(data: DataRecord[]): Promise<BulkResult> {
    this.validateBulkData(data, 'insert');

    const model = this.createModel();
    const config = getConfig();

    const inserted = await model.bulkInsert(data, {
      chunkSize: config.bulkChunkSize,
      cookie: this.ctx.cookie,
    });

    return {
      success: true,
      affected: inserted.length,
      ids: inserted.map((r) => r.id as string),
    };
  }

  /**
   * Bulk update records
   */
  async bulkUpdate(data: DataRecord[]): Promise<BulkResult> {
    this.validateBulkData(data, 'update');

    // Validate all records have IDs
    const invalidRecords = data.filter((r) => !r.id && !(r as { Id?: string }).Id);
    if (invalidRecords.length > 0) {
      throw new BadRequestError(
        'All records must have an id field for bulk update',
        { invalidCount: invalidRecords.length }
      );
    }

    const model = this.createModel();
    const config = getConfig();

    const updated = await model.bulkUpdate(data, {
      chunkSize: config.bulkChunkSize,
      cookie: this.ctx.cookie,
    });

    return {
      success: true,
      affected: updated.length,
    };
  }

  /**
   * Bulk update all matching records
   */
  async bulkUpdateAll(
    params: ListParams,
    updateData: DataRecord
  ): Promise<BulkResult> {
    if (!updateData || typeof updateData !== 'object') {
      throw new BadRequestError('Update data is required');
    }

    const model = this.createModel();
    const affected = await model.bulkUpdateAll(
      this.toListArgs(params),
      updateData,
      { cookie: this.ctx.cookie }
    );

    return {
      success: true,
      affected,
    };
  }

  /**
   * Bulk delete records by IDs
   */
  async bulkDelete(ids: string[]): Promise<BulkResult> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('IDs array is required');
    }

    const config = getConfig();
    if (ids.length > config.maxBulkSize) {
      throw new BadRequestError(
        `Cannot delete more than ${config.maxBulkSize} records at once`,
        { provided: ids.length, max: config.maxBulkSize }
      );
    }

    const model = this.createModel();
    const deleted = await model.bulkDelete(ids, {
      cookie: this.ctx.cookie,
    });

    return {
      success: true,
      affected: deleted,
    };
  }

  /**
   * Bulk delete all matching records
   */
  async bulkDeleteAll(params: ListParams): Promise<BulkResult> {
    const model = this.createModel();
    const deleted = await model.bulkDeleteAll(
      this.toListArgs(params),
      { cookie: this.ctx.cookie }
    );

    return {
      success: true,
      affected: deleted,
    };
  }

  /**
   * Truncate all table data
   */
  async truncate(): Promise<BulkResult> {
    const model = this.createModel();
    const deleted = await model.bulkDeleteAll({}, {
      cookie: this.ctx.cookie,
    });

    return {
      success: true,
      affected: deleted,
    };
  }

  /**
   * Execute mixed bulk write operations
   */
  async bulkWrite(operations: BulkWriteOperation[]): Promise<unknown> {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new BadRequestError('Operations array is required');
    }

    const config = getConfig();
    if (operations.length > config.maxBulkSize) {
      throw new BadRequestError(
        `Cannot execute more than ${config.maxBulkSize} operations at once`,
        { provided: operations.length, max: config.maxBulkSize }
      );
    }

    const model = this.createModel();
    return model.bulkWrite(operations);
  }

  /**
   * Validate bulk data
   */
  private validateBulkData(data: unknown[], operation: string): void {
    if (!Array.isArray(data) || data.length === 0) {
      throw new BadRequestError(
        `Request body must be a non-empty array for bulk ${operation}`
      );
    }

    const config = getConfig();
    if (data.length > config.maxBulkSize) {
      throw new BadRequestError(
        `Cannot ${operation} more than ${config.maxBulkSize} records at once`,
        { provided: data.length, max: config.maxBulkSize }
      );
    }
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
