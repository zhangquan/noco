/**
 * Schema Manager - API for managing table and column definitions
 * @module schema/SchemaManager
 */

import { ulid } from 'ulid';
import type { Column, Table, ColumnConstraints } from '../types';
import { UITypes, RelationTypes } from '../types';

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

// ============================================================================
// Schema Manager Interface
// ============================================================================

export interface ISchemaManager {
  // Table operations
  createTable(definition: TableDefinition): Table;
  getTable(tableId: string): Table | undefined;
  updateTable(tableId: string, updates: Partial<TableDefinition>): Table;
  dropTable(tableId: string): boolean;
  
  // Column operations
  addColumn(tableId: string, column: ColumnDefinition): Column;
  getColumn(tableId: string, columnId: string): Column | undefined;
  updateColumn(tableId: string, columnId: string, updates: Partial<ColumnDefinition>): Column;
  dropColumn(tableId: string, columnId: string): boolean;
  
  // Relationship operations
  createLink(definition: LinkDefinition): { sourceColumn: Column; targetColumn?: Column };
  removeLink(tableId: string, linkColumnId: string): boolean;
  
  // Schema import/export
  exportSchema(): SchemaExport;
  importSchema(schema: SchemaExport, options?: { merge?: boolean }): void;
  
  // Access
  getTables(): Table[];
}

// ============================================================================
// Schema Manager Class
// ============================================================================

/**
 * Schema Manager for programmatic schema management
 * 
 * @example
 * ```typescript
 * const schema = new SchemaManager();
 * 
 * // Create tables
 * schema.createTable({
 *   title: 'Users',
 *   description: 'User accounts',
 *   columns: [
 *     { title: 'Name', uidt: 'SingleLineText', constraints: { required: true } },
 *     { title: 'Email', uidt: 'Email', constraints: { unique: true } }
 *   ]
 * });
 * 
 * // Add column
 * schema.addColumn('users', {
 *   title: 'Age',
 *   uidt: 'Number',
 *   constraints: { min: 0, max: 150 }
 * });
 * 
 * // Create relationship
 * schema.createLink({
 *   sourceTableId: 'users',
 *   targetTableId: 'orders',
 *   linkColumnTitle: 'Orders',
 *   type: 'mm',
 *   bidirectional: true,
 *   inverseLinkColumnTitle: 'Customer'
 * });
 * 
 * // Get tables for model
 * const model = createModel({ db, tableId: 'users', tables: schema.getTables() });
 * ```
 */
export class SchemaManager implements ISchemaManager {
  protected tables: Table[] = [];

  constructor(initialTables?: Table[]) {
    if (initialTables) {
      this.tables = [...initialTables];
    }
  }

  // ==========================================================================
  // Table Operations
  // ==========================================================================

  /**
   * Create a new table
   */
  createTable(definition: TableDefinition): Table {
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
  updateTable(tableId: string, updates: Partial<TableDefinition>): Table {
    const table = this.getTable(tableId);
    if (!table) {
      throw new Error(`Table not found: ${tableId}`);
    }

    if (updates.title !== undefined) table.title = updates.title;
    if (updates.description !== undefined) table.description = updates.description;
    if (updates.hints !== undefined) table.hints = updates.hints;

    return table;
  }

  /**
   * Drop a table
   */
  dropTable(tableId: string): boolean {
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
    return true;
  }

  // ==========================================================================
  // Column Operations
  // ==========================================================================

  /**
   * Add a column to a table
   */
  addColumn(tableId: string, column: ColumnDefinition): Column {
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
  updateColumn(tableId: string, columnId: string, updates: Partial<ColumnDefinition>): Column {
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

    return column;
  }

  /**
   * Drop a column
   */
  dropColumn(tableId: string, columnId: string): boolean {
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
    return true;
  }

  // ==========================================================================
  // Relationship Operations
  // ==========================================================================

  /**
   * Create a link between two tables
   */
  createLink(definition: LinkDefinition): { sourceColumn: Column; targetColumn?: Column } {
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

    return { sourceColumn, targetColumn };
  }

  /**
   * Remove a link column
   */
  removeLink(tableId: string, linkColumnId: string): boolean {
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
   * Import schema from JSON format
   */
  importSchema(schema: SchemaExport, options: { merge?: boolean } = {}): void {
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
 * Create a schema manager instance
 */
export function createSchemaManager(initialTables?: Table[]): SchemaManager {
  return new SchemaManager(initialTables);
}
