/**
 * Database Layer Module
 * Manages database connection and migrations
 * @module db
 */

// ============================================================================
// Types
// ============================================================================

export type {
  DatabaseType,
  DatabaseConfig,
  ConnectionStatus,
  Migration,
  MigrationRecord,
  MigrationResult,
  IdPrefix,
} from './types.js';

// ============================================================================
// Database Manager
// ============================================================================

export {
  DatabaseManager,
  getDbManager,
  getDb,
  getDatabaseType,
} from './DatabaseManager.js';

// ============================================================================
// Migrations
// ============================================================================

export {
  MigrationRunner,
} from './MigrationRunner.js';

export {
  MIGRATIONS,
  runMigrations,
  rollbackMigration,
  getMigrationStatus,
} from './migrations.js';

// ============================================================================
// ID Generator
// ============================================================================

export {
  IdGenerator,
  generateId,
  generateIdWithPrefix,
  generateMigrationId,
  ID_PREFIXES,
} from './IdGenerator.js';

// ============================================================================
// Default Export
// ============================================================================

import { DatabaseManager } from './DatabaseManager.js';
export default DatabaseManager;
