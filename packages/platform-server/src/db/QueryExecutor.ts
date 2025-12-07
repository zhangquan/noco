/**
 * Query Executor
 * Provides CRUD operations for database tables
 * @module db/QueryExecutor
 */

import type { Knex } from 'knex';
import { IdGenerator } from './IdGenerator.js';
import type {
  IQueryExecutor,
  QueryOptions,
  InsertOptions,
  UpdateOptions,
  DeleteOptions,
  ExtendedCondition,
  TransactionCallback,
  DatabaseType,
} from './types.js';

// ============================================================================
// Query Executor Class
// ============================================================================

/**
 * Query Executor implementation
 * Provides type-safe CRUD operations on database tables
 */
export class QueryExecutor implements IQueryExecutor {
  private db: Knex;
  private dbType: DatabaseType;

  constructor(db: Knex, dbType: DatabaseType = 'pg') {
    this.db = db;
    this.dbType = dbType;
  }

  /**
   * Get underlying Knex instance
   */
  getKnex(): Knex {
    return this.db;
  }

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType {
    return this.dbType;
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * Get a single record by ID or condition
   */
  async get<T = Record<string, unknown>>(
    table: string,
    idOrCondition: string | Record<string, unknown>,
    fields?: string[]
  ): Promise<T | null> {
    let query = this.db(table);

    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }

    if (fields?.length) {
      query = query.select(fields);
    }

    const result = await query.first();
    return (result as T) || null;
  }

  /**
   * List records with optional filtering, sorting, and pagination
   */
  async list<T = Record<string, unknown>>(
    table: string,
    options?: QueryOptions
  ): Promise<T[]> {
    let query = this.db(table);

    // Apply simple conditions
    if (options?.condition) {
      query = query.where(options.condition);
    }

    // Apply array conditions
    if (options?.conditionArr) {
      for (const cond of options.conditionArr) {
        query = this.applyCondition(query, cond.key, cond.value, cond.op);
      }
    }

    // Apply extended conditions
    if (options?.xcCondition) {
      query = this.applyExtendedCondition(query, options.xcCondition);
    }

    // Apply field selection
    if (options?.fields?.length) {
      query = query.select(options.fields);
    }

    // Apply ordering
    if (options?.orderBy) {
      for (const [col, dir] of Object.entries(options.orderBy)) {
        query = query.orderBy(col, dir);
      }
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return query as Promise<T[]>;
  }

  // ==========================================================================
  // Write Operations
  // ==========================================================================

  /**
   * Insert a single record
   * @returns The ID of the inserted record
   */
  async insert(
    table: string,
    data: Record<string, unknown>,
    options?: InsertOptions
  ): Promise<string> {
    const insertData = { ...data };

    // Generate ID if not provided
    if (!options?.ignoreIdGeneration && !insertData.id) {
      insertData.id = IdGenerator.generate();
    }

    // Set timestamps
    if (!options?.ignoreTimestamps) {
      const now = new Date();
      if (!insertData.created_at) insertData.created_at = now;
      if (!insertData.updated_at) insertData.updated_at = now;
    }

    await this.db(table).insert(insertData);
    return insertData.id as string;
  }

  /**
   * Insert multiple records
   * @returns Array of IDs
   */
  async insertAll(
    table: string,
    data: Record<string, unknown>[],
    options?: InsertOptions
  ): Promise<string[]> {
    if (data.length === 0) return [];

    const ids: string[] = [];
    const now = new Date();

    const insertData = data.map((record) => {
      const id = (record.id as string) || 
        (!options?.ignoreIdGeneration ? IdGenerator.generate() : (record.id as string));
      ids.push(id);

      const row = { ...record, id };

      if (!options?.ignoreTimestamps) {
        if (!row.created_at) row.created_at = now;
        if (!row.updated_at) row.updated_at = now;
      }

      return row;
    });

    // Batch insert in chunks of 100
    await this.db.batchInsert(table, insertData, 100);

    return ids;
  }

  /**
   * Update record(s)
   * @returns Number of affected rows
   */
  async update(
    table: string,
    data: Record<string, unknown>,
    idOrCondition: string | Record<string, unknown>,
    options?: UpdateOptions
  ): Promise<number> {
    const updateData = { ...data };

    // Set updated_at timestamp
    if (!options?.ignoreTimestamp) {
      updateData.updated_at = new Date();
    }

    let query = this.db(table);

    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }

    if (options?.xcCondition) {
      query = this.applyExtendedCondition(query, options.xcCondition);
    }

    return query.update(updateData);
  }

  /**
   * Delete record(s)
   * @returns Number of deleted rows
   */
  async delete(
    table: string,
    idOrCondition: string | Record<string, unknown>,
    options?: DeleteOptions
  ): Promise<number> {
    let query = this.db(table);

    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }

    if (options?.xcCondition) {
      query = this.applyExtendedCondition(query, options.xcCondition);
    }

    return query.delete();
  }

  /**
   * Delete all records matching condition
   * @returns Number of deleted rows
   */
  async deleteAll(
    table: string,
    condition?: Record<string, unknown>
  ): Promise<number> {
    let query = this.db(table);
    if (condition) {
      query = query.where(condition);
    }
    return query.delete();
  }

  // ==========================================================================
  // Utility Operations
  // ==========================================================================

  /**
   * Count records matching condition
   */
  async count(
    table: string,
    condition?: Record<string, unknown>
  ): Promise<number> {
    let query = this.db(table);
    if (condition) {
      query = query.where(condition);
    }
    const result = await query.count({ count: '*' }).first();
    return Number(result?.count || 0);
  }

  /**
   * Check if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    return this.db.schema.hasTable(tableName);
  }

  /**
   * Execute raw SQL query
   */
  async raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T> {
    const result = await this.db.raw(sql, bindings || []);
    return result as T;
  }

  // ==========================================================================
  // Transaction Support
  // ==========================================================================

  /**
   * Execute callback within a transaction
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Create a new QueryExecutor bound to a transaction
   */
  withTransaction(trx: Knex.Transaction): QueryExecutor {
    return new QueryExecutor(trx as unknown as Knex, this.dbType);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Apply a single condition to query
   */
  private applyCondition(
    query: Knex.QueryBuilder,
    key: string,
    value: unknown,
    op?: string
  ): Knex.QueryBuilder {
    const operator = op || '=';

    switch (operator) {
      case 'is':
        if (value === null) {
          return query.whereNull(key);
        }
        return query.where(key, value as any);

      case 'is not':
        if (value === null) {
          return query.whereNotNull(key);
        }
        return query.whereNot(key, value as any);

      case 'in':
        if (Array.isArray(value)) {
          return query.whereIn(key, value as any[]);
        }
        return query;

      case 'not in':
        if (Array.isArray(value)) {
          return query.whereNotIn(key, value as any[]);
        }
        return query;

      case 'like':
      case 'ilike':
        return query.where(key, operator === 'ilike' && this.dbType === 'pg' ? 'ilike' : 'like', value as string);

      case 'not like':
        return query.whereNot(key, 'like', value as string);

      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          return query.whereBetween(key, value as [any, any]);
        }
        return query;

      default:
        return query.where(key, operator, value as any);
    }
  }

  /**
   * Apply extended condition (supports nested AND/OR)
   */
  private applyExtendedCondition(
    query: Knex.QueryBuilder,
    xcCondition: ExtendedCondition
  ): Knex.QueryBuilder {
    // Handle _and conditions
    if (xcCondition._and) {
      query = query.where((qb) => {
        for (const cond of xcCondition._and as ExtendedCondition[]) {
          this.applyExtendedCondition(qb, cond);
        }
      });
    }

    // Handle _or conditions
    if (xcCondition._or) {
      query = query.where((qb) => {
        let first = true;
        for (const cond of xcCondition._or as ExtendedCondition[]) {
          if (first) {
            this.applyExtendedCondition(qb, cond);
            first = false;
          } else {
            qb.orWhere((innerQb) => {
              this.applyExtendedCondition(innerQb, cond);
            });
          }
        }
      });
    }

    // Handle field conditions
    for (const [key, value] of Object.entries(xcCondition)) {
      if (key.startsWith('_')) continue;

      if (value === null) {
        query = query.whereNull(key);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operator object like { eq: 'value', gt: 10 }
        const condition = value as Record<string, unknown>;
        
        if (condition.eq !== undefined) query = query.where(key, condition.eq as any);
        if (condition.neq !== undefined) query = query.whereNot(key, condition.neq as any);
        if (condition.ne !== undefined) query = query.whereNot(key, condition.ne as any);
        if (condition.like !== undefined) query = query.where(key, 'like', condition.like as string);
        if (condition.nlike !== undefined) query = query.whereNot(key, 'like', condition.nlike as string);
        if (condition.gt !== undefined) query = query.where(key, '>', condition.gt as any);
        if (condition.gte !== undefined) query = query.where(key, '>=', condition.gte as any);
        if (condition.lt !== undefined) query = query.where(key, '<', condition.lt as any);
        if (condition.lte !== undefined) query = query.where(key, '<=', condition.lte as any);
        if (condition.in !== undefined && Array.isArray(condition.in)) {
          query = query.whereIn(key, condition.in as any[]);
        }
        if (condition.nin !== undefined && Array.isArray(condition.nin)) {
          query = query.whereNotIn(key, condition.nin as any[]);
        }
        if (condition.null !== undefined) {
          if (condition.null) {
            query = query.whereNull(key);
          } else {
            query = query.whereNotNull(key);
          }
        }
      } else {
        query = query.where(key, value as any);
      }
    }

    return query;
  }
}

export default QueryExecutor;
