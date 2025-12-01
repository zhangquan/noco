import type { Knex } from 'knex';
import type {
  ColumnType,
  CookieType,
  FilterType,
  ListArgs,
  GroupByArgs,
  RecordType,
  SortType,
  TableType,
  BulkOperationOptions,
} from './types';

/**
 * Base model interface for SQL operations
 * Defines the core CRUD and query operations
 */
export interface BaseModelSql {
  // ========================================
  // Properties
  // ========================================

  /** Database driver (Knex instance) */
  readonly dbDriver: Knex;

  /** Current table/model ID */
  readonly modelId: string;

  /** Current view ID (optional) */
  readonly viewId?: string;

  /** All models/tables in the database */
  readonly models: TableType[];

  /** Current model/table definition */
  readonly model: TableType;

  /** Table alias for queries */
  readonly alias?: string;

  // ========================================
  // CRUD Operations
  // ========================================

  /**
   * Read a record by primary key
   * @param id - Primary key value
   * @param fields - Optional fields to return
   * @returns The record or null if not found
   */
  readByPk(id: string, fields?: string | string[]): Promise<RecordType | null>;

  /**
   * Check if a record exists
   * @param id - Primary key value
   * @returns True if record exists
   */
  exist(id: string): Promise<boolean>;

  /**
   * Find a single record matching criteria
   * @param args - Query arguments
   * @returns The record or null if not found
   */
  findOne(args: ListArgs): Promise<RecordType | null>;

  /**
   * Insert a new record
   * @param data - Record data
   * @param trx - Optional transaction
   * @param cookie - Optional context/cookie
   * @returns The inserted record
   */
  insert(
    data: RecordType,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<RecordType>;

  /**
   * Update a record by primary key
   * @param id - Primary key value
   * @param data - Updated data
   * @param trx - Optional transaction
   * @param cookie - Optional context/cookie
   * @returns The updated record
   */
  updateByPk(
    id: string,
    data: RecordType,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<RecordType>;

  /**
   * Delete a record by primary key
   * @param id - Primary key value
   * @param trx - Optional transaction
   * @param cookie - Optional context/cookie
   * @returns Number of deleted records
   */
  delByPk(
    id: string,
    trx?: Knex.Transaction,
    cookie?: CookieType
  ): Promise<number>;

  // ========================================
  // List Operations
  // ========================================

  /**
   * List records with filtering, sorting, and pagination
   * @param args - Query arguments
   * @param ignoreFilterSort - Whether to ignore filter/sort
   * @returns Array of records
   */
  list(args: ListArgs, ignoreFilterSort?: boolean): Promise<RecordType[]>;

  /**
   * Count records matching criteria
   * @param args - Query arguments
   * @param ignoreFilterSort - Whether to ignore filter/sort
   * @returns Count of records
   */
  count(args?: ListArgs, ignoreFilterSort?: boolean): Promise<number>;

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Bulk insert records
   * @param datas - Array of records to insert
   * @param options - Bulk operation options
   * @returns Array of inserted records
   */
  bulkInsert(
    datas: RecordType[],
    options?: BulkOperationOptions
  ): Promise<RecordType[]>;

  /**
   * Bulk update records
   * @param datas - Array of records with updates (must include PK)
   * @param options - Bulk operation options
   * @returns Array of updated records
   */
  bulkUpdate(
    datas: RecordType[],
    options?: BulkOperationOptions
  ): Promise<RecordType[]>;

  /**
   * Bulk update all records matching criteria
   * @param args - Query arguments for filtering
   * @param data - Data to update
   * @param options - Bulk operation options
   * @returns Number of updated records
   */
  bulkUpdateAll(
    args: ListArgs,
    data: RecordType,
    options?: BulkOperationOptions
  ): Promise<number>;

  /**
   * Bulk delete records by IDs
   * @param ids - Array of primary key values
   * @param options - Bulk operation options
   * @returns Number of deleted records
   */
  bulkDelete(ids: string[], options?: BulkOperationOptions): Promise<number>;

  /**
   * Bulk delete all records matching criteria
   * @param args - Query arguments for filtering
   * @param options - Bulk operation options
   * @returns Number of deleted records
   */
  bulkDeleteAll(args?: ListArgs, options?: BulkOperationOptions): Promise<number>;

  // ========================================
  // Aggregation Operations
  // ========================================

  /**
   * Group by query
   * @param args - Group by arguments
   * @returns Grouped results
   */
  groupBy(args: GroupByArgs): Promise<RecordType[]>;

  /**
   * Group by query (version 2)
   * @param args - Group by arguments
   * @returns Grouped results
   */
  groupByV2(args: GroupByArgs): Promise<RecordType[]>;

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Validate column data
   * @param columns - Array of columns to validate
   * @returns Validation result
   */
  validate(columns: ColumnType[]): Promise<boolean>;

  /**
   * Get query builder for the current model
   * @returns Knex query builder
   */
  getQueryBuilder(): Knex.QueryBuilder;

  /**
   * Get insert query builder (without table_id filter)
   * @returns Knex query builder for inserts
   */
  getInsertQueryBuilder(): Knex.QueryBuilder;

  /**
   * Map field aliases to column names
   * @param data - Record data
   * @param isUpdate - Whether this is an update operation
   * @returns Mapped data with system and user fields separated
   */
  mapAliasToColumn(
    data: RecordType,
    isUpdate?: boolean
  ): { system: RecordType; data: RecordType };

  /**
   * Get SQL table name
   * @param useAlias - Whether to use alias
   * @returns SQL table name
   */
  getSqlTableName(useAlias?: boolean): string;

  /**
   * Get SQL column name for a column
   * @param column - Column definition
   * @param model - Optional model (defaults to current)
   * @returns SQL column expression
   */
  getSqlColumnName(column: ColumnType, model?: TableType): string;

  /**
   * Build SELECT query with column expressions
   * @param params - Query builder and columns
   * @returns Modified query builder
   */
  buildSelectQuery(params: {
    qb: Knex.QueryBuilder;
    columns?: string | string[];
  }): Promise<Knex.QueryBuilder>;

  /**
   * Apply sort and filter to query builder
   * @param qb - Query builder
   * @param args - List arguments with filter/sort
   * @returns Modified query builder
   */
  applySortAndFilter(
    qb: Knex.QueryBuilder,
    args: ListArgs
  ): Promise<Knex.QueryBuilder>;

  /**
   * Extract raw query and execute
   * @param qb - Query builder
   * @param driver - Optional specific driver
   * @returns Query results
   */
  extractRawQueryAndExec<T = RecordType[]>(
    qb: Knex.QueryBuilder,
    driver?: Knex
  ): Promise<T>;
}
