/**
 * Database Manager
 * Manages database connection and provides access to Knex instance
 * @module db/DatabaseManager
 */

import knex, { type Knex } from 'knex';
import type { DatabaseConfig, DatabaseType, ConnectionStatus } from './types.js';

// ============================================================================
// Database Manager Class
// ============================================================================

/**
 * Database Manager - Singleton for managing database connection
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;

  private db: Knex | null = null;
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
      DatabaseManager.instance.db = null;
      DatabaseManager.instance.initialized = false;
    }
    DatabaseManager.instance = null;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Initialize database connection
   */
  async connect(config: DatabaseConfig): Promise<void> {
    if (this.initialized) {
      console.warn('DatabaseManager already initialized');
      return;
    }

    console.log('📦 Connecting to database...');

    // Determine database type
    this.dbType = config.type || this.detectDatabaseType(config.connection);

    // Create database connection
    this.db = this.createKnexInstance(config);

    // Test connection
    await this.testConnection();

    this.initialized = true;
    console.log('✅ Database connection established');
  }

  /**
   * Initialize with existing Knex instance
   */
  initWithKnex(db: Knex, dbType?: DatabaseType): void {
    this.db = db;
    this.dbType = dbType || 'pg';
    this.initialized = true;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Closing database connection...');

    if (this.db) {
      await this.db.destroy();
    }

    this.db = null;
    this.initialized = false;

    console.log('✅ Database connection closed');
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get database Knex instance
   */
  getDb(): Knex {
    if (!this.db) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this.db;
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
    if (!this.db) {
      return {
        connected: false,
        type: this.dbType,
        error: 'Database not initialized',
      };
    }

    try {
      const start = Date.now();
      await this.db.raw('SELECT 1');
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
   * Execute callback within a transaction
   */
  async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.getDb().transaction(callback);
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
  private async testConnection(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not created');
    }
    
    try {
      await this.db.raw('SELECT 1');
      console.log('  ✓ Database connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to database: ${message}`);
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
 * Get database Knex instance
 */
export function getDb(): Knex {
  return DatabaseManager.getInstance().getDb();
}

/**
 * Get database type
 */
export function getDatabaseType(): DatabaseType {
  return DatabaseManager.getInstance().getDatabaseType();
}

export default DatabaseManager;
