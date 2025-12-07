/**
 * Database Manager
 * Manages database connections and provides access to Knex instances
 * @module db/DatabaseManager
 */

import knex, { type Knex } from 'knex';
import type { DatabaseConfig, DatabaseType, ConnectionStatus } from './types.js';

// ============================================================================
// Database Manager Class
// ============================================================================

/**
 * Database Manager - Singleton for managing database connections
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;

  private metaDb: Knex | null = null;
  private dataDb: Knex | null = null;
  private dbType: DatabaseType = 'pg';
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.metaDb = null;
      DatabaseManager.instance.dataDb = null;
      DatabaseManager.instance.initialized = false;
    }
    DatabaseManager.instance = null;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Initialize database connections
   */
  async connect(config: {
    meta: DatabaseConfig;
    data?: DatabaseConfig;
  }): Promise<void> {
    if (this.initialized) {
      console.warn('DatabaseManager already initialized');
      return;
    }

    console.log('📦 Connecting to databases...');

    // Determine database type
    this.dbType = config.meta.type || this.detectDatabaseType(config.meta.connection);

    // Create meta database connection
    this.metaDb = this.createKnexInstance(config.meta);

    // Create data database connection (or reuse meta)
    if (config.data && config.data.connection !== config.meta.connection) {
      this.dataDb = this.createKnexInstance(config.data);
    } else {
      this.dataDb = this.metaDb;
    }

    // Test connections
    await this.testConnection(this.metaDb, 'meta');
    if (this.dataDb !== this.metaDb) {
      await this.testConnection(this.dataDb, 'data');
    }

    this.initialized = true;
    console.log('✅ Database connections established');
  }

  /**
   * Initialize with existing Knex instances
   */
  initWithKnex(metaDb: Knex, dataDb?: Knex, dbType?: DatabaseType): void {
    this.metaDb = metaDb;
    this.dataDb = dataDb || metaDb;
    this.dbType = dbType || 'pg';
    this.initialized = true;
  }

  /**
   * Close all database connections
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Closing database connections...');

    if (this.metaDb) {
      await this.metaDb.destroy();
    }

    if (this.dataDb && this.dataDb !== this.metaDb) {
      await this.dataDb.destroy();
    }

    this.metaDb = null;
    this.dataDb = null;
    this.initialized = false;

    console.log('✅ Database connections closed');
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get meta database Knex instance
   */
  getMetaDb(): Knex {
    if (!this.metaDb) {
      throw new Error('Meta database not initialized. Call connect() first.');
    }
    return this.metaDb;
  }

  /**
   * Get data database Knex instance
   */
  getDataDb(): Knex {
    if (!this.dataDb) {
      throw new Error('Data database not initialized. Call connect() first.');
    }
    return this.dataDb;
  }

  /**
   * Get database type
   */
  getDatabaseType(): DatabaseType {
    return this.dbType;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<ConnectionStatus> {
    if (!this.metaDb) {
      return {
        connected: false,
        type: this.dbType,
        error: 'Database not initialized',
      };
    }

    try {
      const start = Date.now();
      await this.metaDb.raw('SELECT 1');
      const latencyMs = Date.now() - start;

      return {
        connected: true,
        type: this.dbType,
        latencyMs,
      };
    } catch (error) {
      return {
        connected: false,
        type: this.dbType,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // Transaction Support
  // ==========================================================================

  /**
   * Execute callback within a transaction on meta database
   */
  async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.getMetaDb().transaction(callback);
  }

  /**
   * Execute callback within a transaction on data database
   */
  async dataTransaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.getDataDb().transaction(callback);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a Knex instance from config
   */
  private createKnexInstance(config: DatabaseConfig): Knex {
    const dbType = config.type || this.detectDatabaseType(config.connection);

    const knexConfig: Knex.Config = {
      client: this.getKnexClient(dbType),
      connection: config.connection,
      pool: {
        min: config.pool?.min ?? 2,
        max: config.pool?.max ?? 10,
        acquireTimeoutMillis: config.pool?.acquireTimeout ?? 30000,
        idleTimeoutMillis: config.pool?.idleTimeout ?? 10000,
      },
      debug: config.debug ?? false,
    };

    // Add search path for PostgreSQL
    if (dbType === 'pg' && config.searchPath) {
      knexConfig.searchPath = config.searchPath;
    }

    return knex(knexConfig);
  }

  /**
   * Detect database type from connection string
   */
  private detectDatabaseType(connection: string | Knex.StaticConnectionConfig): DatabaseType {
    if (typeof connection === 'string') {
      if (connection.startsWith('postgres://') || connection.startsWith('postgresql://')) {
        return 'pg';
      }
      if (connection.startsWith('mysql://')) {
        return 'mysql';
      }
      if (connection.includes('sqlite') || connection.endsWith('.db') || connection.endsWith('.sqlite')) {
        return 'sqlite';
      }
    }
    return 'pg'; // Default to PostgreSQL
  }

  /**
   * Get Knex client name from database type
   */
  private getKnexClient(dbType: DatabaseType): string {
    switch (dbType) {
      case 'pg':
        return 'pg';
      case 'mysql':
        return 'mysql2';
      case 'sqlite':
        return 'better-sqlite3';
      default:
        return 'pg';
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(db: Knex, name: string): Promise<void> {
    try {
      await db.raw('SELECT 1');
      console.log(`  ✓ ${name} database connected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to ${name} database: ${message}`);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get DatabaseManager instance
 */
export function getDbManager(): DatabaseManager {
  return DatabaseManager.getInstance();
}

/**
 * Get meta database Knex instance
 */
export function getMetaDb(): Knex {
  return DatabaseManager.getInstance().getMetaDb();
}

/**
 * Get data database Knex instance
 */
export function getDataDb(): Knex {
  return DatabaseManager.getInstance().getDataDb();
}

/**
 * Get database type
 */
export function getDatabaseType(): DatabaseType {
  return DatabaseManager.getInstance().getDatabaseType();
}

export default DatabaseManager;
