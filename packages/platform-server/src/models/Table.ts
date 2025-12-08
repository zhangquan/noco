/**
 * Table/Model Entity
 * Pure domain entity for table/model
 * @module models/Table
 */

import type {
  TableType,
  ColumnType,
  ViewType,
  ModelTypes,
  MetaTable,
  isTextCol,
} from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface TableOptions {
  /** Custom Knex instance (for transactions) */
  knex?: unknown;
  /** Skip cache operations */
  skipCache?: boolean;
}

// ============================================================================
// Model Entity Class
// ============================================================================

/**
 * Model class - Pure domain entity for table/model
 * Implements TableType interface from SDK
 * Contains only properties and business logic, no data access
 */
export class Model implements TableType {
  // ==========================================================================
  // Basic Identification Properties
  // ==========================================================================

  id: string;
  title: string;
  table_name?: string;
  slug?: string;
  uuid?: string;
  type?: ModelTypes;

  // ==========================================================================
  // Hierarchy Properties
  // ==========================================================================

  project_id?: string;
  base_id?: string;
  group_id?: string;
  parent_id?: string;
  fk_project_id?: string;
  fk_base_id?: string;

  // ==========================================================================
  // Schema Properties
  // ==========================================================================

  fk_schema_id?: string;
  fk_public_schema_id?: string;
  private _columns?: ColumnType[];
  private _views?: ViewType[];

  // ==========================================================================
  // Configuration Properties
  // ==========================================================================

  enabled?: boolean;
  deleted?: boolean;
  copy_enabled?: boolean;
  export_enabled?: boolean;
  pin?: boolean;
  pinned?: boolean;
  show_all_fields?: boolean;
  password?: string;

  // ==========================================================================
  // Publish State Properties
  // ==========================================================================

  is_publish?: boolean;
  need_publish?: boolean;
  publish_at?: Date;

  // ==========================================================================
  // BigTable Storage Properties
  // ==========================================================================

  bigtable_table_name?: MetaTable;
  mm?: boolean;

  // ==========================================================================
  // Metadata Properties
  // ==========================================================================

  order?: number;
  meta?: Record<string, unknown>;
  description?: string;
  hints?: string[];
  created_at?: Date;
  updated_at?: Date;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  constructor(data: Partial<TableType>) {
    this.id = data.id || '';
    this.title = data.title || '';
    this.table_name = data.table_name;
    this.slug = data.slug;
    this.uuid = data.uuid;
    this.type = data.type;

    this.project_id = data.project_id;
    this.base_id = data.base_id;
    this.group_id = data.group_id;
    this.parent_id = data.parent_id;
    this.fk_project_id = data.fk_project_id;
    this.fk_base_id = data.fk_base_id;

    this.fk_schema_id = data.fk_schema_id;
    this.fk_public_schema_id = data.fk_public_schema_id;
    this._columns = data.columns;
    this._views = data.views;

    this.enabled = data.enabled;
    this.deleted = data.deleted;
    this.copy_enabled = data.copy_enabled;
    this.export_enabled = data.export_enabled;
    this.pin = data.pin;
    this.pinned = data.pinned;
    this.show_all_fields = data.show_all_fields;
    this.password = data.password;

    this.is_publish = data.is_publish;
    this.need_publish = data.need_publish;
    this.publish_at = data.publish_at;

    this.bigtable_table_name = data.bigtable_table_name;
    this.mm = data.mm;

    this.order = data.order;
    this.meta = data.meta;
    this.description = data.description;
    this.hints = data.hints;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // ==========================================================================
  // Column/View Getters & Setters
  // ==========================================================================

  get columns(): ColumnType[] | undefined {
    return this._columns;
  }

  set columns(cols: ColumnType[] | undefined) {
    this._columns = cols;
  }

  get views(): ViewType[] | undefined {
    return this._views;
  }

  set views(views: ViewType[] | undefined) {
    this._views = views;
  }

  // ==========================================================================
  // Primary Key / Primary Value Getters
  // ==========================================================================

  /**
   * Get the primary key column
   */
  get primaryKey(): ColumnType | undefined {
    const columns = this._columns || [];

    // First, try to find a column with pk: true
    const pkColumn = columns.find((col) => col.pk === true);
    if (pkColumn) {
      return pkColumn;
    }

    // Fallback: find column named 'id'
    return columns.find(
      (col) => col.column_name === 'id' || col.id === 'id' || col.title?.toLowerCase() === 'id'
    );
  }

  /**
   * Get all primary key columns (for composite keys)
   */
  get primaryKeys(): ColumnType[] {
    const columns = this._columns || [];
    return columns.filter((col) => col.pk === true);
  }

  /**
   * Get the primary value column (display column)
   */
  get primaryValue(): ColumnType | undefined {
    const columns = this._columns || [];

    // First, try to find a column with pv: true
    const pvColumn = columns.find((col) => col.pv === true);
    if (pvColumn) {
      return pvColumn;
    }

    // Fallback: find first text column that's not the primary key
    const { isTextCol: isText } = require('../types/index.js');
    return columns.find((col) => !col.pk && isText(col));
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if model is active (enabled and not deleted)
   */
  get isActive(): boolean {
    return (this.enabled ?? true) && !(this.deleted ?? false);
  }

  /**
   * Check if model needs publishing
   */
  get needsPublish(): boolean {
    return this.need_publish ?? false;
  }

  /**
   * Get effective project ID
   */
  get effectiveProjectId(): string {
    return this.project_id || this.fk_project_id || '';
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): TableType {
    return {
      id: this.id,
      title: this.title,
      table_name: this.table_name,
      slug: this.slug,
      uuid: this.uuid,
      type: this.type,
      project_id: this.project_id,
      base_id: this.base_id,
      group_id: this.group_id,
      parent_id: this.parent_id,
      fk_project_id: this.fk_project_id,
      fk_base_id: this.fk_base_id,
      fk_schema_id: this.fk_schema_id,
      fk_public_schema_id: this.fk_public_schema_id,
      columns: this._columns,
      views: this._views,
      enabled: this.enabled,
      deleted: this.deleted,
      copy_enabled: this.copy_enabled,
      export_enabled: this.export_enabled,
      pin: this.pin,
      pinned: this.pinned,
      show_all_fields: this.show_all_fields,
      password: this.password,
      is_publish: this.is_publish,
      need_publish: this.need_publish,
      publish_at: this.publish_at,
      bigtable_table_name: this.bigtable_table_name,
      mm: this.mm,
      order: this.order,
      meta: this.meta,
      description: this.description,
      hints: this.hints,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * Get raw data
   */
  getData(): TableType {
    return this.toJSON();
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: Partial<TableType>): void {
    Object.assign(this, new Model(data));
  }

  /**
   * Set columns
   */
  setColumns(columns: ColumnType[]): void {
    this._columns = columns;
  }

  /**
   * Set views
   */
  setViews(views: ViewType[]): void {
    this._views = views;
  }

  /**
   * Mark as needing publish
   */
  markNeedPublish(): void {
    this.need_publish = true;
  }

  /**
   * Mark as published
   */
  markPublished(): void {
    this.is_publish = true;
    this.need_publish = false;
    this.publish_at = new Date();
  }
}

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

// Re-export TableOptions type
export type { TableOptions as QueryOptions };

// Generate ID function (from repository for backward compatibility)
export { genId } from '../repositories/BaseRepository.js';

export default Model;
