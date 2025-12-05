/**
 * Schema Manager - API for managing table and column definitions
 * @module schema/SchemaManager
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import type { Column, Table, ColumnConstraints } from '../types';
import { UITypes, RelationTypes } from '../types';
import { SchemaStore, type SchemaData, type SchemaStoreOptions } from './SchemaStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Column definition for creating a new column
 */
export interface ColumnDefinition {
  id?: string;
  title: string;
  uidt: UITypes | string;
  description?: string;
  examples?: unknown[];
  constraints?: ColumnConstraints;
  defaultValue?: unknown;
  options?: Column['options'];
}

/**
 * Table definition for creating a new table
 */
export interface TableDefinition {
  id?: string;
  title: string;
  description?: string;
  hints?: string[];
  columns?: ColumnDefinition[];
}

/**
 * Link definition for creating relationships
 */
export interface LinkDefinition {
  sourceTableId: string;
  targetTableId: string;
  linkColumnTitle: string;
  type?: 'mm' | 'hm' | 'bt';
  bidirectional?: boolean;
  inverseLinkColumnTitle?: string;
  description?: string;
}

/**
 * Schema export format
 */
export interface SchemaExport {
  version: string;
  exportedAt: string;
  tables: Table[];
}

/**
 * Schema manager options for persistence
 */
export interface SchemaManagerOptions {
  /** Knex database instance for persistence */
  db?: Knex;
  /** Namespace for multi-tenant support */
  namespace?: string;
  /** Auto-save changes to database */
  autoSave?: boolean;
  /** Initial tables (for in-memory mode) */
  initialTables?: Table[];
  /** Schema metadata */
  meta?: SchemaData['meta'];
}

// ============================================================================
// Schema Manager Interface
// ============================================================================

export interface ISchemaManager {
  // Table operations
  createTable(definition: TableDefinition): Table | Promise<Table>;
  getTable(tableId: string): Table | undefined;
  updateTable(tableId: string, updates: Partial<TableDefinition>): Table | Promise<Table>;
  dropTable(tableId: string): boolean | Promise<boolean>;
  
  // Column operations
  addColumn(tableId: string, column: ColumnDefinition): Column | Promise<Column>;
  getColumn(tableId: string, columnId: string): Column | undefined;
  updateColumn(tableId: string, columnId: string, updates: Partial<ColumnDefinition>): Column | Promise<Column>;
  dropColumn(tableId: string, columnId: string): boolean | Promise<boolean>;
  
  // Relationship operations
  createLink(definition: LinkDefinition): { sourceColumn: Column; targetColumn?: Column } | Promise<{ sourceColumn: Column; targetColumn?: Column }>;
  removeLink(tableId: string, linkColumnId: string): boolean | Promise<boolean>;
  
  // Schema import/export
  exportSchema(): SchemaExport;
  importSchema(schema: SchemaExport, options?: { merge?: boolean }): void | Promise<void>;
  
  // Access
  getTables(): Table[];
  
  // Persistence (optional)
  save?(): Promise<void>;
  load?(): Promise<void>;
}

// ============================================================================
// Schema Manager Class
// ============================================================================

/**
 * Schema Manager for programmatic schema management
 * 
 * Supports two modes:
 * 1. In-memory mode (no db provided) - schema stored only in memory
 * 2. Persistent mode (db provided) - schema stored as JSON in PostgreSQL
 * 
 * @example
 * ```typescript
 * // In-memory mode
 * const schema = new SchemaManager();
 * 
 * // Persistent mode
 * const schema = new SchemaManager({
 *   db: knex,
 *   namespace: 'my_app',
 *   autoSave: true,
 * });
 * await schema.load(); // Load existing schema from DB
 * 
 * // Create tables
 * await schema.createTable({
 *   title: 'Users',
 *   description: 'User accounts',
 *   columns: [
 *     { title: 'Name', uidt: 'SingleLineText', constraints: { required: true } },
 *     { title: 'Email', uidt: 'Email', constraints: { unique: true } }
 *   ]
 * });
 * 
 * // Add column
 * await schema.addColumn('users', {
 *   title: 'Age',
 *   uidt: 'Number',
 *   constraints: { min: 0, max: 150 }
 * });
 * 
 * // Create relationship
 * await schema.createLink({
 *   sourceTableId: 'users',
 *   targetTableId: 'orders',
 *   linkColumnTitle: 'Orders',
 *   type: 'mm',
 *   bidirectional: true,
 *   inverseLinkColumnTitle: 'Customer'
 * });
 * 
 * // Manual save (if autoSave is false)
 * await schema.save();
 * 
 * // Get tables for model
 * const model = createModel({ db, tableId: 'users', tables: schema.getTables() });
 * ```
 */
export class SchemaManager implements ISchemaManager {
  protected tables: Table[] = [];
  protected store: SchemaStore | null = null;
  protected autoSave: boolean = false;
  protected meta?: SchemaData['meta'];
  protected dirty: boolean = false;

  constructor(options?: SchemaManagerOptions | Table[]) {
    // Support legacy constructor signature (array of tables)
    if (Array.isArray(options)) {
      this.tables = [...options];
      return;
    }

    if (options) {
      if (options.initialTables) {
        this.tables = [...options.initialTables];
      }
      if (options.db) {
        this.store = new SchemaStore({
          db: options.db,
          namespace: options.namespace,
        });
      }
      this.autoSave = options.autoSave ?? false;
      this.meta = options.meta;
    }
  }

  // ==========================================================================
  // Persistence Operations
  // ==========================================================================

  /**
   * Save schema to database (only works in persistent mode)
   */
  async save(): Promise<void> {
    if (!this.store) {
      throw new Error('Cannot save: SchemaManager not configured with database');
    }
    await this.store.save(this.tables, this.meta);
    this.dirty = false;
  }

  /**
   * Load schema from database (only works in persistent mode)
   */
  async load(): Promise<void> {
    if (!this.store) {
      throw new Error('Cannot load: SchemaManager not configured with database');
    }
    const schema = await this.store.load();
    if (schema) {
      this.tables = schema.tables;
      this.meta = schema.meta;
    }
    this.dirty = false;
  }

  /**
   * Check if there are unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Get the schema store (for advanced operations)
   */
  getStore(): SchemaStore | null {
    return this.store;
  }

  /**
   * Auto-save if enabled
   */
  protected async autoSaveIfEnabled(): Promise<void> {
    this.dirty = true;
    if (this.autoSave && this.store) {
      await this.save();
    }
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  /**
   * Create a new table
   */
  async createTable(definition: TableDefinition): Promise<Table> {
    const tableId = definition.id || this.generateId(definition.title);
    
    // Check for duplicate
    if (this.tables.find((t) => t.id === tableId)) {
      throw new Error(`Table with id '${tableId}' already exists`);
    }

    const columns: Column[] = (definition.columns || []).map((col) => 
      this.normalizeColumn(col)
    );

    const table: Table = {
      id: tableId,
      title: definition.title,
      name: tableId,
      description: definition.description,
      hints: definition.hints,
      columns,
      type: 'table',
    };

    this.tables.push(table);
    await this.autoSaveIfEnabled();
    return table;
  }

  /**
   * Create a new table (sync version for in-memory mode)
   */
  createTableSync(definition: TableDefinition): Table {
    const tableId = definition.id || this.generateId(definition.title);
    
    if (this.tables.find((t) => t.id === tableId)) {
      throw new Error(`Table with id '${tableId}' already exists`);
    }

    const columns: Column[] = (definition.columns || []).map((col) => 
      this.normalizeColumn(col)
    );

    const table: Table = {
      id: tableId,
      title: definition.title,
      name: tableId,
      description: definition.description,
      hints: definition.hints,
      columns,
      type: 'table',
    };

    this.tables.push(table);
    this.dirty = true;
    return table;
  }

  /**
   * Get a table by ID
   */
  getTable(tableId: string): Table | undefined {
    return this.tables.find((t) => t.id === tableId);
  }

  /**
   * Update a table
   */
  async updateTable(tableId: string, updates: Partial<TableDefinition>): Promise<Table> {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    if (updates.title !== undefined) table.title = updates.title;
    if (updates.description !== undefined) table.description = updates.description;
    if (updates.hints !== undefined) table.hints = updates.hints;

    await this.autoSaveIfEnabled();
    return table;
  }

  /**
   * Drop a table
   */
  async dropTable(tableId: string): Promise<boolean> {
    const index = this.tables.findIndex((t) => t.id === tableId);
    if (index === -1) return false;

    // Remove any links pointing to this table
    for (const table of this.tables) {
      if (table.columns) {
        table.columns = table.columns.filter((col) => {
          if (col.uidt === UITypes.Links || col.uidt === UITypes.LinkToAnotherRecord) {
            const opts = this.getColOptions(col);
            return opts?.fk_related_model_id !== tableId;
          }
          return true;
        });
      }
    }

    this.tables.splice(index, 1);
    await this.autoSaveIfEnabled();
    return true;
  }

  // ==========================================================================
  // Column Operations
  // ==========================================================================

  /**
   * Add a column to a table
   */
  async addColumn(tableId: string, column: ColumnDefinition): Promise<Column> {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    if (!table.columns) {
      table.columns = [];
    }

    const normalizedColumn = this.normalizeColumn(column);

    // Check for duplicate
    if (table.columns.find((c) => c.id === normalizedColumn.id)) {
      throw new Error(`Column with id '${normalizedColumn.id}' already exists in table '${tableId}'`);
    }

    table.columns.push(normalizedColumn);
    await this.autoSaveIfEnabled();
    return normalizedColumn;
  }

  /**
   * Add a column to a table (sync version for in-memory mode)
   */
  addColumnSync(tableId: string, column: ColumnDefinition): Column {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    if (!table.columns) {
      table.columns = [];
    }

    const normalizedColumn = this.normalizeColumn(column);

    if (table.columns.find((c) => c.id === normalizedColumn.id)) {
      throw new Error(`Column with id '${normalizedColumn.id}' already exists in table '${tableId}'`);
    }

    table.columns.push(normalizedColumn);
    this.dirty = true;
    return normalizedColumn;
  }

  /**
   * Get a column by ID
   */
  getColumn(tableId: string, columnId: string): Column | undefined {
    const table = this.getTable(tableId);
    if (!table) return undefined;
    return table.columns?.find((c) => c.id === columnId);
  }

  /**
   * Update a column
   */
  async updateColumn(tableId: string, columnId: string, updates: Partial<ColumnDefinition>): Promise<Column> {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    const column = table.columns?.find((c) => c.id === columnId);
    if (!column) {
      throw new Error(`Column not found: ${columnId}`);
    }

    if (updates.title !== undefined) column.title = updates.title;
    if (updates.uidt !== undefined) column.uidt = updates.uidt;
    if (updates.description !== undefined) column.description = updates.description;
    if (updates.examples !== undefined) column.examples = updates.examples;
    if (updates.constraints !== undefined) column.constraints = updates.constraints;
    if (updates.defaultValue !== undefined) column.defaultValue = updates.defaultValue;
    if (updates.options !== undefined) column.options = updates.options;

    await this.autoSaveIfEnabled();
    return column;
  }

  /**
   * Drop a column
   */
  async dropColumn(tableId: string, columnId: string): Promise<boolean> {
    const table = this.getTable(tableId);
    if (!table || !table.columns) return false;

    const index = table.columns.findIndex((c) => c.id === columnId);
    if (index === -1) return false;

    // If it's a link column, remove the inverse link if exists
    const column = table.columns[index];
    if (column.uidt === UITypes.Links || column.uidt === UITypes.LinkToAnotherRecord) {
      this.removeInverseLink(column);
    }

    table.columns.splice(index, 1);
    await this.autoSaveIfEnabled();
    return true;
  }

  // ==========================================================================
  // Relationship Operations
  // ==========================================================================

  /**
   * Create a link between two tables
   */
  async createLink(definition: LinkDefinition): Promise<{ sourceColumn: Column; targetColumn?: Column }> {
    const sourceTable = this.getTable(definition.sourceTableId);
    const targetTable = this.getTable(definition.targetTableId);

    if (!sourceTable) {
      throw new Error(`Source table not found: ${definition.sourceTableId}`);
    }
    if (!targetTable) {
      throw new Error(`Target table not found: ${definition.targetTableId}`);
    }

    const linkType = definition.type || 'mm';
    const sourceColumnId = this.generateId(definition.linkColumnTitle);

    // Create source column
    const sourceColumn: Column = {
      id: sourceColumnId,
      title: definition.linkColumnTitle,
      name: sourceColumnId,
      uidt: UITypes.Links,
      description: definition.description,
      colOptions: {
        type: linkType === 'mm' ? RelationTypes.MANY_TO_MANY : 
              linkType === 'hm' ? RelationTypes.HAS_MANY : RelationTypes.BELONGS_TO,
        fk_related_model_id: definition.targetTableId,
      },
    };

    if (!sourceTable.columns) sourceTable.columns = [];
    sourceTable.columns.push(sourceColumn);

    // Create inverse column if bidirectional
    let targetColumn: Column | undefined;
    if (definition.bidirectional) {
      const targetColumnId = this.generateId(definition.inverseLinkColumnTitle || sourceTable.title);
      
      targetColumn = {
        id: targetColumnId,
        title: definition.inverseLinkColumnTitle || sourceTable.title,
        name: targetColumnId,
        uidt: UITypes.Links,
        colOptions: {
          type: linkType === 'mm' ? RelationTypes.MANY_TO_MANY :
                linkType === 'hm' ? RelationTypes.BELONGS_TO : RelationTypes.HAS_MANY,
          fk_related_model_id: definition.sourceTableId,
        },
      };

      if (!targetTable.columns) targetTable.columns = [];
      targetTable.columns.push(targetColumn);

      // Update source column to reference inverse
      (sourceColumn.colOptions as Record<string, unknown>).fk_symmetric_column_id = targetColumnId;
      (targetColumn.colOptions as Record<string, unknown>).fk_symmetric_column_id = sourceColumnId;
    }

    await this.autoSaveIfEnabled();
    return { sourceColumn, targetColumn };
  }

  /**
   * Remove a link column
   */
  async removeLink(tableId: string, linkColumnId: string): Promise<boolean> {
    const column = this.getColumn(tableId, linkColumnId);
    if (!column) return false;

    if (column.uidt !== UITypes.Links && column.uidt !== UITypes.LinkToAnotherRecord) {
      throw new Error(`Column '${linkColumnId}' is not a link column`);
    }

    return this.dropColumn(tableId, linkColumnId);
  }

  // ==========================================================================
  // Import/Export
  // ==========================================================================

  /**
   * Export schema to JSON format
   */
  exportSchema(): SchemaExport {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: JSON.parse(JSON.stringify(this.tables)),
    };
  }

  /**
   * Export schema to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.exportSchema(), null, 2);
  }

  /**
   * Import schema from JSON format
   */
  async importSchema(schema: SchemaExport, options: { merge?: boolean } = {}): Promise<void> {
    if (options.merge) {
      // Merge with existing tables
      for (const table of schema.tables) {
        const existing = this.getTable(table.id);
        if (existing) {
          // Update existing table
          Object.assign(existing, table);
        } else {
          // Add new table
          this.tables.push(table);
        }
      }
    } else {
      // Replace all tables
      this.tables = [...schema.tables];
    }
    await this.autoSaveIfEnabled();
  }

  /**
   * Import schema from JSON string
   */
  async fromJSON(json: string): Promise<void> {
    const schema = JSON.parse(json) as SchemaExport;
    await this.importSchema(schema);
  }

  /**
   * Import schema from JSON format (sync version)
   */
  importSchemaSync(schema: SchemaExport, options: { merge?: boolean } = {}): void {
    if (options.merge) {
      for (const table of schema.tables) {
        const existing = this.getTable(table.id);
        if (existing) {
          Object.assign(existing, table);
        } else {
          this.tables.push(table);
        }
      }
    } else {
      this.tables = [...schema.tables];
    }
    this.dirty = true;
  }

  // ==========================================================================
  // Access
  // ==========================================================================

  /**
   * Get all tables
   */
  getTables(): Table[] {
    return this.tables;
  }

  // ==========================================================================
  // Protected Helpers
  // ==========================================================================

  protected generateId(title: string): string {
    // Generate a URL-safe ID from title
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return `${base}_${ulid().slice(-6).toLowerCase()}`;
  }

  protected normalizeColumn(definition: ColumnDefinition): Column {
    const id = definition.id || this.generateId(definition.title);
    
    return {
      id,
      title: definition.title,
      name: id,
      uidt: definition.uidt,
      description: definition.description,
      examples: definition.examples,
      constraints: definition.constraints,
      defaultValue: definition.defaultValue,
      options: definition.options,
      required: definition.constraints?.required,
    };
  }

  protected getColOptions(column: Column): Record<string, unknown> | null {
    const options = column.colOptions || column.options;
    if (!options) return null;
    return typeof options === 'string' ? JSON.parse(options) : options as Record<string, unknown>;
  }

  protected removeInverseLink(column: Column): void {
    const opts = this.getColOptions(column);
    if (!opts) return;

    const symmetricColumnId = opts.fk_symmetric_column_id as string;
    const relatedTableId = opts.fk_related_model_id as string;

    if (symmetricColumnId && relatedTableId) {
      const relatedTable = this.getTable(relatedTableId);
      if (relatedTable?.columns) {
        const index = relatedTable.columns.findIndex((c) => c.id === symmetricColumnId);
        if (index !== -1) {
          relatedTable.columns.splice(index, 1);
        }
      }
    }
  }
}

/**
 * Create a schema manager instance (in-memory mode)
 */
export function createSchemaManager(initialTables?: Table[]): SchemaManager {
  return new SchemaManager(initialTables);
}

/**
 * Create a schema manager instance with persistence
 */
export function createPersistentSchemaManager(options: SchemaManagerOptions): SchemaManager {
  return new SchemaManager(options);
}

/**
 * Create a schema manager and load existing schema from database
 */
export async function loadSchemaManager(options: SchemaManagerOptions): Promise<SchemaManager> {
  const manager = new SchemaManager(options);
  await manager.load();
  return manager;
}
