import type { Knex } from 'knex';
import type {
  CookieType,
  ListArgs,
  RecordType,
} from './types';

/**
 * Interface for many-to-many relationship operations
 */
export interface LinkModelSql {
  // ========================================
  // MM List Operations
  // ========================================

  /**
   * Get list of related records in a many-to-many relationship
   * @param params - Column ID and parent row ID
   * @param args - Query arguments
   * @returns Array of related records
   */
  mmList(
    params: { colId: string; parentRowId: string },
    args?: ListArgs
  ): Promise<RecordType[]>;

  /**
   * Count related records in a many-to-many relationship
   * @param params - Column ID and parent row ID
   * @returns Count of related records
   */
  mmListCount(params: { colId: string; parentRowId: string }): Promise<number>;

  // ========================================
  // MM Excluded List Operations
  // ========================================

  /**
   * Get list of records NOT linked in a many-to-many relationship
   * @param params - Column ID and parent row ID
   * @param args - Query arguments
   * @returns Array of excluded records
   */
  getMmChildrenExcludedList(
    params: { colId: string; parentRowId: string },
    args?: ListArgs
  ): Promise<RecordType[]>;

  /**
   * Count records NOT linked in a many-to-many relationship
   * @param params - Column ID and parent row ID
   * @param args - Query arguments
   * @returns Count of excluded records
   */
  getMmChildrenExcludedListCount(
    params: { colId: string; parentRowId: string },
    args?: ListArgs
  ): Promise<number>;

  // ========================================
  // MM Relationship Operations
  // ========================================

  /**
   * Check if a parent-child relationship exists
   * @param params - Column ID, parent row ID, child row ID
   * @returns True if relationship exists
   */
  hasChild(params: {
    colId: string;
    parentRowId: string;
    childRowId: string;
    cookie?: CookieType;
  }): Promise<boolean>;

  /**
   * Add a child to a parent (create MM relationship)
   * @param params - Column ID, row ID (parent), child ID
   * @returns True if successful
   */
  addChild(params: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<boolean>;

  /**
   * Remove a child from a parent (delete MM relationship)
   * @param params - Column ID, row ID (parent), child ID
   * @returns True if successful
   */
  removeChild(params: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: CookieType;
    trx?: Knex.Transaction;
  }): Promise<boolean>;

  // ========================================
  // MM Query Building
  // ========================================

  /**
   * Build subquery for MM list
   * @param mainTable - Main table
   * @param mmTable - Junction table
   * @param parentRowId - Parent row ID (optional)
   * @param limit - Limit (optional)
   * @param offset - Offset (optional)
   * @returns Subquery builder
   */
  mmSubQueryBuild(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId?: string,
    limit?: number,
    offset?: number
  ): Knex.QueryBuilder;

  /**
   * Build count subquery for MM
   * @param mainTable - Main table
   * @param mmTable - Junction table
   * @param parentRowId - Parent row ID
   * @returns Count subquery builder
   */
  mmCountSubQueryBuild(
    mainTable: { id: string },
    mmTable: { id: string },
    parentRowId: string
  ): Knex.QueryBuilder;
}
