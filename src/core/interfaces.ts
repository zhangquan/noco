/**
 * Core interfaces for model operations
 * @module core/interfaces
 */

import type { Knex } from 'knex';
import type { Column, Table, ListArgs, GroupByArgs, BulkOptions, RequestContext, Record } from '../types';

// ============================================================================
// Base Model Interface
// ============================================================================

/**
 * Base model interface for SQL operations
 */
export interface IBaseModel {
  // Properties
  readonly db: Knex;
  readonly tableId: string;
  readonly viewId?: string;
  readonly tables: Table[];
  readonly table: Table;
  readonly alias?: string;

  // CRUD Operations
  readByPk(id: string, fields?: string | string[]): Promise<Record | null>;
  exists(id: string): Promise<boolean>;
  findOne(args: ListArgs): Promise<Record | null>;
  insert(data: Record, trx?: Knex.Transaction, ctx?: RequestContext): Promise<Record>;
  updateByPk(id: string, data: Record, trx?: Knex.Transaction, ctx?: RequestContext): Promise<Record>;
  deleteByPk(id: string, trx?: Knex.Transaction, ctx?: RequestContext): Promise<number>;

  // List Operations
  list(args?: ListArgs, ignoreFilterSort?: boolean): Promise<Record[]>;
  count(args?: ListArgs, ignoreFilterSort?: boolean): Promise<number>;

  // Bulk Operations
  bulkInsert(data: Record[], options?: BulkOptions): Promise<Record[]>;
  bulkUpdate(data: Record[], options?: BulkOptions): Promise<Record[]>;
  bulkUpdateAll(args: ListArgs, data: Record, options?: BulkOptions): Promise<number>;
  bulkDelete(ids: string[], options?: BulkOptions): Promise<number>;
  bulkDeleteAll(args?: ListArgs, options?: BulkOptions): Promise<number>;

  // Aggregation
  groupBy(args: GroupByArgs): Promise<Record[]>;

  // Query Building
  getQueryBuilder(): Knex.QueryBuilder;
  getInsertBuilder(): Knex.QueryBuilder;
}

// ============================================================================
// Link Model Interface
// ============================================================================

/**
 * Interface for many-to-many relationship operations
 */
export interface ILinkModel {
  // MM List Operations
  mmList(params: { colId: string; parentRowId: string }, args?: ListArgs): Promise<Record[]>;
  mmListCount(params: { colId: string; parentRowId: string }): Promise<number>;

  // MM Excluded List
  getExcludedList(params: { colId: string; parentRowId: string }, args?: ListArgs): Promise<Record[]>;
  getExcludedListCount(params: { colId: string; parentRowId: string }, args?: ListArgs): Promise<number>;

  // Relationship Operations
  hasLink(params: { colId: string; parentRowId: string; childRowId: string }): Promise<boolean>;
  addLink(params: { colId: string; rowId: string; childId: string; trx?: Knex.Transaction }): Promise<boolean>;
  removeLink(params: { colId: string; rowId: string; childId: string; trx?: Knex.Transaction }): Promise<boolean>;

  // Query Building
  buildMmSubquery(mainTable: { id: string }, mmTable: { id: string }, parentRowId?: string, limit?: number, offset?: number): Knex.QueryBuilder;
  buildMmCountSubquery(mainTable: { id: string }, mmTable: { id: string }, parentRowId: string): Knex.QueryBuilder;
}

// ============================================================================
// Combined Model Interface
// ============================================================================

/**
 * Full model interface combining base and link operations
 */
export interface IModel extends IBaseModel, ILinkModel {}
