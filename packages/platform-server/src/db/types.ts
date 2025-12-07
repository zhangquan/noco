/**
 * Database Layer Type Definitions
 * @module db/types
 */

import type { Knex } from 'knex';

// ============================================================================
// Database Connection Types
// ============================================================================

/**
 * Supported database types
 */
export type DatabaseType = 'pg' | 'mysql' | 'sqlite';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database type */
  type: DatabaseType;
  /** Connection URL or connection object */
  connection: string | Knex.StaticConnectionConfig;
  /** Connection pool settings */
  pool?: {
    min?: number;
    max?: number;
    /** Acquire timeout in ms */
    acquireTimeout?: number;
    /** Idle timeout in ms */
    idleTimeout?: number;
  };
  /** Search path for PostgreSQL */
  searchPath?: string[];
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Database connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  type: DatabaseType;
  latencyMs?: number;
  error?: string;
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Condition operator for advanced queries
 */
export type ConditionOperator = 
  | '=' | '!=' | '<>' 
  | '>' | '>=' | '<' | '<=' 
  | 'like' | 'ilike' | 'not like'
  | 'in' | 'not in' 
  | 'is' | 'is not'
  | 'between';

/**
 * Single condition for queries
 */
export interface QueryCondition {
  key: string;
  value: unknown;
  op?: ConditionOperator;
}

/**
 * Extended condition supporting nested AND/OR
 */
export interface ExtendedCondition {
  _and?: ExtendedCondition[];
  _or?: ExtendedCondition[];
  [key: string]: unknown;
}

/**
 * Query options for list operations
 */
export interface QueryOptions {
  /** Simple key-value conditions */
  condition?: Record<string, unknown>;
  /** Array of conditions with operators */
  conditionArr?: QueryCondition[];
  /** Extended conditions with AND/OR support */
  xcCondition?: ExtendedCondition;
  /** Order by columns */
  orderBy?: Record<string, 'asc' | 'desc'>;
  /** Limit results */
  limit?: number;
  /** Offset results */
  offset?: number;
  /** Select specific fields */
  fields?: string[];
}

/**
 * Insert options
 */
export interface InsertOptions {
  /** Skip automatic ID generation */
  ignoreIdGeneration?: boolean;
  /** Skip automatic timestamp setting */
  ignoreTimestamps?: boolean;
}

/**
 * Update options
 */
export interface UpdateOptions {
  /** Extended conditions */
  xcCondition?: ExtendedCondition;
  /** Skip automatic updated_at timestamp */
  ignoreTimestamp?: boolean;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Extended conditions */
  xcCondition?: ExtendedCondition;
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Migration definition
 */
export interface Migration {
  /** Unique migration name */
  name: string;
  /** Migration up function */
  up: (db: Knex) => Promise<void>;
  /** Migration down function */
  down: (db: Knex) => Promise<void>;
}

/**
 * Migration status record
 */
export interface MigrationRecord {
  id: string;
  name: string;
  executed_at: Date;
}

/**
 * Migration run result
 */
export interface MigrationResult {
  success: boolean;
  migrationsRun: string[];
  error?: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction callback function type
 */
export type TransactionCallback<T> = (trx: Knex.Transaction) => Promise<T>;

// ============================================================================
// ID Generator Types
// ============================================================================

/**
 * ID prefix mapping
 */
export type IdPrefix = 
  | 'usr'  // User
  | 'prj'  // Project
  | 'bas'  // Base/Database
  | 'app'  // App
  | 'pag'  // Page
  | 'flw'  // Flow
  | 'fla'  // Flow App
  | 'sch'  // Schema
  | 'org'  // Organization
  | 'mig'  // Migration
  | 'pru'  // Project User
  | 'oru'  // Org User
  | 'pub'; // Publish State

// ============================================================================
// Query Executor Interface
// ============================================================================

/**
 * Query executor interface for CRUD operations
 */
export interface IQueryExecutor {
  /**
   * Get a single record by ID or condition
   */
  get<T = Record<string, unknown>>(
    table: string,
    idOrCondition: string | Record<string, unknown>,
    fields?: string[]
  ): Promise<T | null>;

  /**
   * List records with optional filtering
   */
  list<T = Record<string, unknown>>(
    table: string,
    options?: QueryOptions
  ): Promise<T[]>;

  /**
   * Insert a single record
   */
  insert(
    table: string,
    data: Record<string, unknown>,
    options?: InsertOptions
  ): Promise<string>;

  /**
   * Insert multiple records
   */
  insertAll(
    table: string,
    data: Record<string, unknown>[],
    options?: InsertOptions
  ): Promise<string[]>;

  /**
   * Update record(s)
   */
  update(
    table: string,
    data: Record<string, unknown>,
    idOrCondition: string | Record<string, unknown>,
    options?: UpdateOptions
  ): Promise<number>;

  /**
   * Delete record(s)
   */
  delete(
    table: string,
    idOrCondition: string | Record<string, unknown>,
    options?: DeleteOptions
  ): Promise<number>;

  /**
   * Count records
   */
  count(
    table: string,
    condition?: Record<string, unknown>
  ): Promise<number>;

  /**
   * Execute raw SQL
   */
  raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T>;

  /**
   * Check if table exists
   */
  tableExists(tableName: string): Promise<boolean>;

  /**
   * Execute within a transaction
   */
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;

  /**
   * Create a new executor instance bound to a transaction
   */
  withTransaction(trx: Knex.Transaction): IQueryExecutor;

  /**
   * Get the underlying Knex instance
   */
  getKnex(): Knex;
}

// ============================================================================
// Database Manager Interface
// ============================================================================

/**
 * Database manager interface
 */
export interface IDatabaseManager {
  /**
   * Initialize database connection
   */
  connect(config: DatabaseConfig): Promise<void>;

  /**
   * Close database connection
   */
  disconnect(): Promise<void>;

  /**
   * Check connection health
   */
  healthCheck(): Promise<ConnectionStatus>;

  /**
   * Get query executor
   */
  getQueryExecutor(): IQueryExecutor;

  /**
   * Get underlying Knex instance
   */
  getKnex(): Knex;

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType;

  /**
   * Check if connected
   */
  isConnected(): boolean;
}
