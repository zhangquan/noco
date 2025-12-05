/**
 * Relation Service
 * Business logic for relationship operations
 * @module rest-api/services/RelationService
 */

import type { DataRecord, Column, ListArgs } from '../../types';
import { UITypes } from '../../types';
import { createModel } from '../../models/Model';
import type { RequestContext, ListParams, PagedResponse } from '../types';
import { paginate } from '../utils';
import { NotFoundError, BadRequestError } from '../middleware';

/**
 * Relation Service
 * Handles link/unlink operations between records
 */
export class RelationService {
  constructor(private ctx: RequestContext) {}

  /**
   * List linked records
   */
  async listLinked(
    rowId: string,
    columnName: string,
    params: ListParams
  ): Promise<PagedResponse<DataRecord>> {
    const column = this.getLinkColumn(columnName);
    const model = this.createModel();

    if (!model.links) {
      throw new BadRequestError('Link operations not available');
    }

    const args: ListArgs = {
      ...this.toListArgs(params),
      parentId: rowId,
    };

    const [list, count] = await Promise.all([
      model.links.mmList(column, args),
      model.links.mmListCount(column, args),
    ]);

    return paginate(list, count, params.offset, params.limit);
  }

  /**
   * List available (not yet linked) records
   */
  async listAvailable(
    rowId: string,
    columnName: string,
    params: ListParams
  ): Promise<PagedResponse<DataRecord>> {
    const column = this.getLinkColumn(columnName);
    const model = this.createModel();

    if (!model.links) {
      throw new BadRequestError('Link operations not available');
    }

    const args: ListArgs = {
      ...this.toListArgs(params),
      parentId: rowId,
    };

    const [list, count] = await Promise.all([
      model.links.mmExcludedList(column, args),
      model.links.mmExcludedListCount(column, args),
    ]);

    return paginate(list, count, params.offset, params.limit);
  }

  /**
   * Get single linked record (for belongs-to)
   */
  async getLinked(
    rowId: string,
    columnName: string
  ): Promise<DataRecord | null> {
    const column = this.getLinkColumn(columnName);
    const model = this.createModel();

    if (!model.links) {
      throw new BadRequestError('Link operations not available');
    }

    const list = await model.links.mmList(column, {
      parentId: rowId,
      limit: 1,
    });

    return list.length > 0 ? list[0] : null;
  }

  /**
   * Link records
   */
  async link(
    rowId: string,
    columnName: string,
    targetIds: string[]
  ): Promise<{ linked: number }> {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      throw new BadRequestError('Target record IDs are required');
    }

    const column = this.getLinkColumn(columnName);
    const model = this.createModel();

    if (!model.links) {
      throw new BadRequestError('Link operations not available');
    }

    await model.links.mmLink(column, targetIds, rowId);

    return { linked: targetIds.length };
  }

  /**
   * Unlink records
   */
  async unlink(
    rowId: string,
    columnName: string,
    targetIds: string[]
  ): Promise<{ unlinked: number }> {
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      throw new BadRequestError('Target record IDs are required');
    }

    const column = this.getLinkColumn(columnName);
    const model = this.createModel();

    if (!model.links) {
      throw new BadRequestError('Link operations not available');
    }

    await model.links.mmUnlink(column, targetIds, rowId);

    return { unlinked: targetIds.length };
  }

  /**
   * Link single record
   */
  async linkOne(
    rowId: string,
    columnName: string,
    targetId: string
  ): Promise<{ linked: boolean }> {
    const result = await this.link(rowId, columnName, [targetId]);
    return { linked: result.linked > 0 };
  }

  /**
   * Unlink single record
   */
  async unlinkOne(
    rowId: string,
    columnName: string,
    targetId: string
  ): Promise<{ unlinked: boolean }> {
    const result = await this.unlink(rowId, columnName, [targetId]);
    return { unlinked: result.unlinked > 0 };
  }

  /**
   * Get link column from table
   */
  private getLinkColumn(columnName: string): Column {
    const { table } = this.ctx;
    if (!table?.columns) {
      throw new NotFoundError('Table columns not found');
    }

    const column = table.columns.find(
      (c) => c.id === columnName || c.title === columnName
    );

    if (!column) {
      throw new NotFoundError(
        `Column '${columnName}' not found in table '${table.title || table.id}'`
      );
    }

    if (
      column.uidt !== UITypes.Links &&
      column.uidt !== UITypes.LinkToAnotherRecord
    ) {
      throw new BadRequestError(
        `Column '${columnName}' is not a link column`
      );
    }

    return column;
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
