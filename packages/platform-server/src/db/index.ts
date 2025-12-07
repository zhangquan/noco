/**
 * Database Layer Module
 * Manages database connections and migrations
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
  getMetaDb,
  getDataDb,
  getDatabaseType,
} from './DatabaseManager.js';

// ============================================================================
// Migration Runner
// ============================================================================

export {
  MigrationRunner,
  runMigrations,
  rollbackMigration,
} from './MigrationRunner.js';

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
