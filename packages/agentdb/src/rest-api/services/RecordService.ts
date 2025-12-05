/**
 * Record Service
 * Business logic for single record operations
 * @module rest-api/services/RecordService
 */

import type { DataRecord, ListArgs, GroupByArgs } from '../../types';
import { createModel, createLazyModel } from '../../models/Model';
import type { RequestContext, ListParams, PagedResponse } from '../types';
import { paginate } from '../utils';
import { NotFoundError } from '../middleware';

/**
 * Record Service
 * Handles single record CRUD operations
 */
export class RecordService {
  constructor(private ctx: RequestContext) {}

  /**
   * List records with pagination
   */
  async list(params: ListParams): Promise<PagedResponse<DataRecord>> {
    const model = this.createModel();
    const args = this.toListArgs(params);

    const [records, count] = await Promise.all([
      model.list(args),
      model.count(args),
    ]);

    return paginate(records, count, params.offset, params.limit);
  }

  /**
   * Get single record by ID
   */
  async getById(id: string, fields?: string[]): Promise<DataRecord> {
    const model = this.createModel();
    const fieldsStr = fields?.join(',');
    const record = await model.readByPk(id, fieldsStr);

    if (!record) {
      throw new NotFoundError(`Record '${id}' not found`, { id });
    }

    return record;
  }

  /**
   * Find one record matching criteria
   */
  async findOne(params: ListParams): Promise<DataRecord | null> {
    const model = this.createModel();
    const args = this.toListArgs(params);
    return model.findOne(args);
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const model = this.createModel();
    return model.exists(id);
  }

  /**
   * Get record count
   */
  async count(params: ListParams): Promise<number> {
    const model = this.createModel();
    const args = this.toListArgs(params);
    return model.count(args);
  }

  /**
   * Group by aggregation
   */
  async groupBy(
    columnId: string,
    aggregation: string,
    params: ListParams
  ): Promise<DataRecord[]> {
    const model = this.createModel();
    const args: GroupByArgs = {
      ...this.toListArgs(params),
      columnId,
      aggregation: aggregation || 'count',
    };
    return model.groupBy(args);
  }

  /**
   * Create new record
   */
  async create(data: DataRecord): Promise<DataRecord> {
    const model = this.createModel();
    return model.insert(data, undefined, this.ctx.cookie);
  }

  /**
   * Update record by ID
   */
  async update(id: string, data: Partial<DataRecord>): Promise<DataRecord> {
    const model = this.createModel();
    return model.updateByPk(id, data, undefined, this.ctx.cookie);
  }

  /**
   * Delete record by ID
   */
  async delete(id: string): Promise<number> {
    const model = this.createModel();
    return model.deleteByPk(id, undefined, this.ctx.cookie);
  }

  /**
   * Get schema description
   */
  describeSchema(): unknown {
    const model = this.createModel();
    return model.describeSchema();
  }

  /**
   * Get all tables overview
   */
  describeAllTables(): unknown {
    const model = this.createModel();
    return model.describeAllTables();
  }

  /**
   * Create model instance
   */
  private createModel(lazyLoading = false) {
    const factory = lazyLoading ? createLazyModel : createModel;
    return factory({
      db: this.ctx.db,
      tableId: this.ctx.tableId!,
      tables: this.ctx.tables,
      viewId: this.ctx.viewId,
    });
  }

  /**
   * Convert ListParams to ListArgs
   */
  private toListArgs(params: ListParams): ListArgs {
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
