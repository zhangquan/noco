/**
 * Schema Store - JSON-based persistence for table and column definitions
 * @module schema/SchemaStore
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { Table, Column } from '../types';
import { TABLE_SCHEMA } from '../config';

// ============================================================================
// Types
// ============================================================================

/**
 * Schema record stored in database
 */
export interface SchemaRecord {
  /** Unique schema identifier (ULID) */
  id: string;
  /** Namespace for multi-tenant support */
  namespace: string;
  /** Schema version */
  version: number;
  /** Schema data stored as JSONB */
  schema: SchemaData;
  /** Creation timestamp */
  created_at: Date;
  /** Last update timestamp */
  updated_at: Date;
}

/**
 * Schema data structure stored in JSONB
 */
export interface SchemaData {
  /** All table definitions */
  tables: Table[];
  /** Schema metadata */
  meta?: {
    /** Schema name */
    name?: string;
    /** Schema description */
    description?: string;
    /** Custom properties */
    [key: string]: unknown;
  };
}

/**
 * Schema store options
 */
export interface SchemaStoreOptions {
  /** Database instance */
  db: Knex;
  /** Namespace for multi-tenant support (default: 'default') */
  namespace?: string;
}

// ============================================================================
// Schema Store Interface
// ============================================================================

export interface ISchemaStore {
  // Schema operations
  save(tables: Table[], meta?: SchemaData['meta']): Promise<SchemaRecord>;
  load(): Promise<SchemaData | null>;
  loadVersion(version: number): Promise<SchemaData | null>;
  
  // Table operations
  getTable(tableId: string): Promise<Table | null>;
  saveTable(table: Table): Promise<void>;
  deleteTable(tableId: string): Promise<boolean>;
  
  // Version management
  getVersions(): Promise<number[]>;
  getCurrentVersion(): Promise<number>;
  
  // Utilities
  exists(): Promise<boolean>;
  clear(): Promise<void>;
}

// ============================================================================
// Schema Store Class
// ============================================================================

/**
 * Schema Store for JSON-based schema persistence
 * 
 * Stores table and column definitions in a JSONB column in PostgreSQL.
 * Supports versioning and multi-tenant namespaces.
 * 
 * @example
 * ```typescript
 * const store = new SchemaStore({ db: knex, namespace: 'my_app' });
 * 
 * // Save schema
 * await store.save(tables, { name: 'My Schema' });
 * 
 * // Load schema
 * const schema = await store.load();
 * console.log(schema?.tables);
 * 
 * // Get specific table
 * const usersTable = await store.getTable('users');
 * ```
 */
export class SchemaStore implements ISchemaStore {
  protected db: Knex;
  protected namespace: string;
  protected tableName = TABLE_SCHEMA;

  constructor(options: SchemaStoreOptions) {
    this.db = options.db;
    this.namespace = options.namespace || 'default';
  }

  // ==========================================================================
  // Schema Operations
  // ==========================================================================

  /**
   * Save schema to database
   * Creates a new version of the schema
   */
  async save(tables: Table[], meta?: SchemaData['meta']): Promise<SchemaRecord> {
    const currentVersion = await this.getCurrentVersion();
    const newVersion = currentVersion + 1;
    
    const schemaData: SchemaData = {
      tables: JSON.parse(JSON.stringify(tables)), // Deep clone
      meta,
    };

    const record: Omit<SchemaRecord, 'created_at' | 'updated_at'> & {
      created_at: Knex.Raw;
      updated_at: Knex.Raw;
    } = {
      id: ulid(),
      namespace: this.namespace,
      version: newVersion,
      schema: schemaData as unknown as SchemaData,
      created_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
    };

    await this.db(this.tableName).insert(record);

    // Fetch and return the inserted record
    const inserted = await this.db(this.tableName)
      .where({ id: record.id })
      .first();
    
    return this.parseRecord(inserted);
  }

  /**
   * Load the latest schema from database
   */
  async load(): Promise<SchemaData | null> {
    const record = await this.db(this.tableName)
      .where({ namespace: this.namespace })
      .orderBy('version', 'desc')
      .first();

    if (!record) return null;

    return this.parseSchemaData(record.schema);
  }

  /**
   * Load a specific version of the schema
   */
  async loadVersion(version: number): Promise<SchemaData | null> {
    const record = await this.db(this.tableName)
      .where({ namespace: this.namespace, version })
      .first();

    if (!record) return null;

    return this.parseSchemaData(record.schema);
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  /**
   * Get a specific table from the current schema
   */
  async getTable(tableId: string): Promise<Table | null> {
    const schema = await this.load();
    if (!schema) return null;

    return schema.tables.find((t) => t.id === tableId) || null;
  }

  /**
   * Save or update a table in the schema
   * This creates a new version with the updated table
   */
  async saveTable(table: Table): Promise<void> {
    const schema = await this.load();
    const tables = schema?.tables || [];
    
    // Find and update or add table
    const existingIndex = tables.findIndex((t) => t.id === table.id);
    if (existingIndex >= 0) {
      tables[existingIndex] = table;
    } else {
      tables.push(table);
    }

    await this.save(tables, schema?.meta);
  }

  /**
   * Delete a table from the schema
   * This creates a new version without the deleted table
   */
  async deleteTable(tableId: string): Promise<boolean> {
    const schema = await this.load();
    if (!schema) return false;

    const initialLength = schema.tables.length;
    const tables = schema.tables.filter((t) => t.id !== tableId);
    
    if (tables.length === initialLength) return false;

    await this.save(tables, schema.meta);
    return true;
  }

  // ==========================================================================
  // Version Management
  // ==========================================================================

  /**
   * Get all available schema versions
   */
  async getVersions(): Promise<number[]> {
    const records = await this.db(this.tableName)
      .where({ namespace: this.namespace })
      .select('version')
      .orderBy('version', 'desc');

    return records.map((r) => r.version);
  }

  /**
   * Get the current (latest) schema version
   */
  async getCurrentVersion(): Promise<number> {
    const record = await this.db(this.tableName)
      .where({ namespace: this.namespace })
      .max('version as version')
      .first();

    return record?.version || 0;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Check if schema exists for this namespace
   */
  async exists(): Promise<boolean> {
    const record = await this.db(this.tableName)
      .where({ namespace: this.namespace })
      .first();

    return !!record;
  }

  /**
   * Clear all schema versions for this namespace
   */
  async clear(): Promise<void> {
    await this.db(this.tableName)
      .where({ namespace: this.namespace })
      .delete();
  }

  /**
   * Get the namespace
   */
  getNamespace(): string {
    return this.namespace;
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected parseRecord(record: Record<string, unknown>): SchemaRecord {
    return {
      id: record.id as string,
      namespace: record.namespace as string,
      version: record.version as number,
      schema: this.parseSchemaData(record.schema),
      created_at: new Date(record.created_at as string),
      updated_at: new Date(record.updated_at as string),
    };
  }

  protected parseSchemaData(data: unknown): SchemaData {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data as SchemaData;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a schema store instance
 */
export function createSchemaStore(options: SchemaStoreOptions): SchemaStore {
  return new SchemaStore(options);
}
