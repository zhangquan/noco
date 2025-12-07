/**
 * Database Migrations
 * @module lib/migrations
 */

import type { Knex } from 'knex';
import { MigrationRunner, type Migration } from '../db/index.js';
import { MetaTable } from '../types/index.js';

// ============================================================================
// Migration Definitions
// ============================================================================

export const MIGRATIONS: Migration[] = [
  // =========================================================================
  // V1: Core Tables
  // =========================================================================
  {
    name: '001_create_users_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.USERS);
      if (exists) return;

      await db.schema.createTable(MetaTable.USERS, (t) => {
        t.string('id', 26).primary();
        t.string('email', 255).notNullable().unique();
        t.string('password', 255).nullable();
        t.string('salt', 255).nullable();
        t.string('firstname', 255).nullable();
        t.string('lastname', 255).nullable();
        t.string('roles', 50).notNullable().defaultTo('user');
        t.string('invite_token', 255).nullable();
        t.timestamp('invite_token_expires').nullable();
        t.string('reset_password_token', 255).nullable();
        t.timestamp('reset_password_expires').nullable();
        t.string('email_verification_token', 255).nullable();
        t.boolean('email_verified').defaultTo(false);
        t.string('org_selected_id', 26).nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('email');
        t.index('invite_token');
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.USERS);
    },
  },

  {
    name: '002_create_orgs_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.ORGS);
      if (exists) return;

      await db.schema.createTable(MetaTable.ORGS, (t) => {
        t.string('id', 26).primary();
        t.string('title', 255).notNullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });

      await db.schema.createTable(MetaTable.ORG_USERS, (t) => {
        t.string('id', 26).primary();
        t.string('org_id', 26).notNullable().references('id').inTable(MetaTable.ORGS).onDelete('CASCADE');
        t.string('user_id', 26).notNullable().references('id').inTable(MetaTable.USERS).onDelete('CASCADE');
        t.string('roles', 50).notNullable().defaultTo('viewer');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.unique(['org_id', 'user_id']);
        t.index('user_id');
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.ORG_USERS);
      await db.schema.dropTableIfExists(MetaTable.ORGS);
    },
  },

  {
    name: '003_create_projects_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.PROJECTS);
      if (exists) return;

      await db.schema.createTable(MetaTable.PROJECTS, (t) => {
        t.string('id', 26).primary();
        t.string('title', 255).notNullable();
        t.string('prefix', 50).notNullable();
        t.text('description').nullable();
        t.string('org_id', 26).nullable();
        t.boolean('is_meta').defaultTo(false);
        t.boolean('deleted').defaultTo(false);
        t.integer('order').defaultTo(0);
        t.string('color', 50).nullable();
        t.jsonb('meta').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('org_id');
        t.index('deleted');
        t.index(['deleted', 'order']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.PROJECTS);
    },
  },

  {
    name: '004_create_project_users_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.PROJECT_USERS);
      if (exists) return;

      await db.schema.createTable(MetaTable.PROJECT_USERS, (t) => {
        t.string('id', 26).primary();
        t.string('project_id', 26).notNullable().references('id').inTable(MetaTable.PROJECTS).onDelete('CASCADE');
        t.string('user_id', 26).notNullable().references('id').inTable(MetaTable.USERS).onDelete('CASCADE');
        t.string('roles', 50).notNullable().defaultTo('viewer');
        t.boolean('starred').defaultTo(false);
        t.boolean('hidden').defaultTo(false);
        t.integer('order').defaultTo(0);
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.unique(['project_id', 'user_id']);
        t.index('user_id');
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.PROJECT_USERS);
    },
  },

  {
    name: '005_create_bases_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.BASES);
      if (exists) return;

      await db.schema.createTable(MetaTable.BASES, (t) => {
        t.string('id', 26).primary();
        t.string('project_id', 26).notNullable().references('id').inTable(MetaTable.PROJECTS).onDelete('CASCADE');
        t.string('alias', 255).nullable();
        t.string('type', 20).notNullable().defaultTo('pg');
        t.boolean('is_default_data_server_db').defaultTo(false);
        t.boolean('is_meta').defaultTo(false);
        t.text('config').nullable(); // Encrypted
        t.string('inflection_column', 50).nullable();
        t.string('inflection_table', 50).nullable();
        t.integer('order').defaultTo(0);
        t.boolean('enabled').defaultTo(true);
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('project_id');
        t.index(['project_id', 'is_default_data_server_db']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.BASES);
    },
  },

  {
    name: '006_create_apps_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.APPS);
      if (exists) return;

      await db.schema.createTable(MetaTable.APPS, (t) => {
        t.string('id', 26).primary();
        t.string('project_id', 26).notNullable().references('id').inTable(MetaTable.PROJECTS).onDelete('CASCADE');
        t.string('title', 255).notNullable();
        t.string('type', 50).notNullable().defaultTo('page');
        t.string('fk_schema_id', 26).nullable();
        t.string('fk_publish_schema_id', 26).nullable();
        t.integer('order').defaultTo(0);
        t.jsonb('meta').nullable();
        t.string('status', 20).defaultTo('active');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('project_id');
        t.index(['project_id', 'type']);
        t.index(['project_id', 'order']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.APPS);
    },
  },

  {
    name: '007_create_pages_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.PAGES);
      if (exists) return;

      await db.schema.createTable(MetaTable.PAGES, (t) => {
        t.string('id', 26).primary();
        t.string('app_id', 26).notNullable().references('id').inTable(MetaTable.APPS).onDelete('CASCADE');
        t.string('title', 255).notNullable();
        t.string('route', 255).nullable();
        t.string('fk_schema_id', 26).nullable();
        t.string('fk_publish_schema_id', 26).nullable();
        t.integer('order').defaultTo(0);
        t.jsonb('meta').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('app_id');
        t.index(['app_id', 'route']);
        t.index(['app_id', 'order']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.PAGES);
    },
  },

  {
    name: '008_create_flow_apps_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.FLOW_APPS);
      if (exists) return;

      await db.schema.createTable(MetaTable.FLOW_APPS, (t) => {
        t.string('id', 26).primary();
        t.string('project_id', 26).notNullable().references('id').inTable(MetaTable.PROJECTS).onDelete('CASCADE');
        t.string('title', 255).notNullable();
        t.string('fk_schema_id', 26).nullable();
        t.string('fk_publish_schema_id', 26).nullable();
        t.string('trigger_type', 50).defaultTo('manual');
        t.boolean('enabled').defaultTo(true);
        t.jsonb('meta').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('project_id');
        t.index(['project_id', 'enabled']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.FLOW_APPS);
    },
  },

  {
    name: '009_create_flows_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.FLOWS);
      if (exists) return;

      await db.schema.createTable(MetaTable.FLOWS, (t) => {
        t.string('id', 26).primary();
        t.string('flow_app_id', 26).notNullable().references('id').inTable(MetaTable.FLOW_APPS).onDelete('CASCADE');
        t.string('title', 255).notNullable();
        t.integer('version').notNullable().defaultTo(1);
        t.jsonb('definition').nullable();
        t.string('status', 20).defaultTo('draft');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('flow_app_id');
        t.index(['flow_app_id', 'version']);
        t.index(['flow_app_id', 'status']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.FLOWS);
    },
  },

  {
    name: '010_create_schemas_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.SCHEMAS);
      if (exists) return;

      await db.schema.createTable(MetaTable.SCHEMAS, (t) => {
        t.string('id', 26).primary();
        t.string('domain', 50).notNullable();
        t.string('fk_domain_id', 26).notNullable();
        t.string('fk_project_id', 26).notNullable();
        t.jsonb('data').notNullable().defaultTo('{}');
        t.string('env', 10).notNullable().defaultTo('DEV');
        t.integer('version').defaultTo(1);
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('fk_project_id');
        t.index(['domain', 'fk_domain_id']);
        t.index(['fk_project_id', 'env']);
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.SCHEMAS);
    },
  },

  {
    name: '011_create_publish_states_table',
    async up(db: Knex) {
      const exists = await db.schema.hasTable(MetaTable.PUBLISH_STATES);
      if (exists) return;

      await db.schema.createTable(MetaTable.PUBLISH_STATES, (t) => {
        t.string('id', 26).primary();
        t.string('project_id', 26).notNullable().references('id').inTable(MetaTable.PROJECTS).onDelete('CASCADE');
        t.string('status', 20).notNullable().defaultTo('draft');
        t.timestamp('published_at').nullable();
        t.string('published_by', 26).nullable();
        t.jsonb('meta').nullable();
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());

        t.index('project_id');
      });
    },
    async down(db: Knex) {
      await db.schema.dropTableIfExists(MetaTable.PUBLISH_STATES);
    },
  },

  // =========================================================================
  // V2: Performance Indexes
  // =========================================================================
  {
    name: '020_add_performance_indexes',
    async up(db: Knex) {
      // Add GIN indexes for JSONB columns if using PostgreSQL
      const client = db.client.config.client;
      if (client === 'pg' || client === 'postgresql') {
        await db.raw(`
          CREATE INDEX IF NOT EXISTS idx_projects_meta ON ${MetaTable.PROJECTS} USING GIN(meta);
          CREATE INDEX IF NOT EXISTS idx_apps_meta ON ${MetaTable.APPS} USING GIN(meta);
          CREATE INDEX IF NOT EXISTS idx_pages_meta ON ${MetaTable.PAGES} USING GIN(meta);
          CREATE INDEX IF NOT EXISTS idx_flows_definition ON ${MetaTable.FLOWS} USING GIN(definition);
          CREATE INDEX IF NOT EXISTS idx_schemas_data ON ${MetaTable.SCHEMAS} USING GIN(data);
        `);
      }
    },
    async down(db: Knex) {
      const client = db.client.config.client;
      if (client === 'pg' || client === 'postgresql') {
        await db.raw(`
          DROP INDEX IF EXISTS idx_projects_meta;
          DROP INDEX IF EXISTS idx_apps_meta;
          DROP INDEX IF EXISTS idx_pages_meta;
          DROP INDEX IF EXISTS idx_flows_definition;
          DROP INDEX IF EXISTS idx_schemas_data;
        `);
      }
    },
  },
];

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Run all pending migrations
 */
export async function runMigrations(db: Knex): Promise<void> {
  console.log('📋 Running migrations...');
  const runner = new MigrationRunner(db, MIGRATIONS);
  const result = await runner.runAll();
  
  if (!result.success) {
    throw new Error(`Migration failed: ${result.error}`);
  }
}

/**
 * Rollback last migration
 */
export async function rollbackMigration(db: Knex): Promise<void> {
  console.log('📋 Rolling back migration...');
  const runner = new MigrationRunner(db, MIGRATIONS);
  const result = await runner.rollbackLast();
  
  if (!result.success) {
    throw new Error(`Rollback failed: ${result.error}`);
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(db: Knex): Promise<{
  executed: string[];
  pending: string[];
}> {
  const runner = new MigrationRunner(db, MIGRATIONS);
  const status = await runner.getStatus();
  return {
    executed: status.executed.map(m => m.name),
    pending: status.pending,
  };
}

export default runMigrations;
