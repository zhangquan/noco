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
  type?: DatabaseType;
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
