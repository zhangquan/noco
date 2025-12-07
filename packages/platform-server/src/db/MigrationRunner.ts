/**
 * Migration Runner
 * Handles database schema migrations
 * @module db/MigrationRunner
 */

import type { Knex } from 'knex';
import { IdGenerator } from './IdGenerator.js';
import type { Migration, MigrationRecord, MigrationResult } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const MIGRATIONS_TABLE = 'nc_migrations';

// ============================================================================
// Migration Runner Class
// ============================================================================

/**
 * Migration Runner - Manages database schema migrations
 */
export class MigrationRunner {
  private db: Knex;
  private migrations: Migration[];

  constructor(db: Knex, migrations: Migration[] = []) {
    this.db = db;
    this.migrations = migrations;
  }

  /**
   * Set migrations list
   */
  setMigrations(migrations: Migration[]): void {
    this.migrations = migrations;
  }

  /**
   * Add a migration
   */
  addMigration(migration: Migration): void {
    this.migrations.push(migration);
  }

  // ==========================================================================
  // Migration Operations
  // ==========================================================================

  /**
   * Run all pending migrations
   */
  async runAll(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsRun: [],
    };

    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get executed migrations
      const executed = await this.getExecutedMigrations();
      const executedNames = new Set(executed.map((m) => m.name));

      // Run pending migrations
      for (const migration of this.migrations) {
        if (!executedNames.has(migration.name)) {
          console.log(`  Running migration: ${migration.name}`);
          await this.runMigration(migration);
          result.migrationsRun.push(migration.name);
        }
      }

      if (result.migrationsRun.length === 0) {
        console.log('  No pending migrations');
      } else {
        console.log(`  ✓ Ran ${result.migrationsRun.length} migration(s)`);
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('  ✗ Migration failed:', result.error);
    }

    return result;
  }

  /**
   * Rollback last migration
   */
  async rollbackLast(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsRun: [],
    };

    try {
      await this.ensureMigrationsTable();

      const lastMigration = await this.db(MIGRATIONS_TABLE)
        .orderBy('executed_at', 'desc')
        .first<MigrationRecord>();

      if (!lastMigration) {
        console.log('  No migrations to rollback');
        return result;
      }

      const migration = this.migrations.find((m) => m.name === lastMigration.name);
      if (!migration) {
        throw new Error(`Migration "${lastMigration.name}" not found in migrations list`);
      }

      console.log(`  Rolling back: ${migration.name}`);
      await migration.down(this.db);
      await this.db(MIGRATIONS_TABLE).where('name', migration.name).delete();
      result.migrationsRun.push(migration.name);

      console.log(`  ✓ Rolled back: ${migration.name}`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('  ✗ Rollback failed:', result.error);
    }

    return result;
  }

  /**
   * Rollback to a specific migration
   */
  async rollbackTo(migrationName: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsRun: [],
    };

    try {
      await this.ensureMigrationsTable();

      const executed = await this.getExecutedMigrations();
      const targetIndex = executed.findIndex((m) => m.name === migrationName);

      if (targetIndex === -1) {
        throw new Error(`Migration "${migrationName}" not found in executed migrations`);
      }

      // Rollback all migrations after target
      const toRollback = executed.slice(0, targetIndex).reverse();

      for (const record of toRollback) {
        const migration = this.migrations.find((m) => m.name === record.name);
        if (!migration) {
          throw new Error(`Migration "${record.name}" not found in migrations list`);
        }

        console.log(`  Rolling back: ${migration.name}`);
        await migration.down(this.db);
        await this.db(MIGRATIONS_TABLE).where('name', migration.name).delete();
        result.migrationsRun.push(migration.name);
      }

      console.log(`  ✓ Rolled back ${result.migrationsRun.length} migration(s)`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('  ✗ Rollback failed:', result.error);
    }

    return result;
  }

  /**
   * Reset all migrations (rollback all)
   */
  async reset(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migrationsRun: [],
    };

    try {
      await this.ensureMigrationsTable();

      const executed = await this.getExecutedMigrations();

      // Rollback in reverse order
      for (const record of executed.reverse()) {
        const migration = this.migrations.find((m) => m.name === record.name);
        if (!migration) {
          console.warn(`  Warning: Migration "${record.name}" not found, skipping`);
          continue;
        }

        console.log(`  Rolling back: ${migration.name}`);
        await migration.down(this.db);
        await this.db(MIGRATIONS_TABLE).where('name', migration.name).delete();
        result.migrationsRun.push(migration.name);
      }

      console.log(`  ✓ Reset ${result.migrationsRun.length} migration(s)`);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('  ✗ Reset failed:', result.error);
    }

    return result;
  }

  /**
   * Refresh migrations (reset + run all)
   */
  async refresh(): Promise<MigrationResult> {
    console.log('  Refreshing migrations...');

    const resetResult = await this.reset();
    if (!resetResult.success) {
      return resetResult;
    }

    return this.runAll();
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: MigrationRecord[];
    pending: string[];
  }> {
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();
    const executedNames = new Set(executed.map((m) => m.name));

    const pending = this.migrations
      .filter((m) => !executedNames.has(m.name))
      .map((m) => m.name);

    return { executed, pending };
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    return this.db(MIGRATIONS_TABLE)
      .select('*')
      .orderBy('executed_at', 'desc') as Promise<MigrationRecord[]>;
  }

  /**
   * Check if a specific migration has been executed
   */
  async isMigrationExecuted(name: string): Promise<boolean> {
    const result = await this.db(MIGRATIONS_TABLE).where('name', name).first();
    return !!result;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Ensure migrations tracking table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const exists = await this.db.schema.hasTable(MIGRATIONS_TABLE);
    if (!exists) {
      await this.db.schema.createTable(MIGRATIONS_TABLE, (t) => {
        t.string('id', 26).primary();
        t.string('name', 255).notNullable().unique();
        t.timestamp('executed_at').defaultTo(this.db.fn.now());
      });
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    await migration.up(this.db);
    await this.db(MIGRATIONS_TABLE).insert({
      id: IdGenerator.generateWithPrefix('mig'),
      name: migration.name,
    });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create and run migrations
 */
export async function runMigrations(db: Knex, migrations: Migration[]): Promise<MigrationResult> {
  const runner = new MigrationRunner(db, migrations);
  return runner.runAll();
}

/**
 * Rollback last migration
 */
export async function rollbackMigration(db: Knex, migrations: Migration[]): Promise<MigrationResult> {
  const runner = new MigrationRunner(db, migrations);
  return runner.rollbackLast();
}

export default MigrationRunner;
