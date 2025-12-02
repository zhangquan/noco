/**
 * Table and View type definitions
 * @module types/table
 */

import type { Column } from './column';

// ============================================================================
// Table Definition
// ============================================================================

/**
 * Table/Model definition
 */
export interface Table {
  /** Unique table identifier */
  id: string;
  /** Display title */
  title: string;
  /** Table name (optional, defaults to id) */
  name?: string;
  /** Is many-to-many junction table */
  mm?: boolean;
  /** Table type */
  type?: 'table' | 'view';
  /** Additional metadata */
  meta?: Record<string, unknown>;
  /** Column definitions */
  columns?: Column[];
  /** Display order */
  order?: number;
  /** Timestamps */
  createdAt?: string;
  updatedAt?: string;
}

/**
 * @deprecated Use Table with name instead of table_name
 */
export interface LegacyTable extends Omit<Table, 'name' | 'createdAt' | 'updatedAt'> {
  table_name?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// View Types
// ============================================================================

/**
 * View types enum
 */
export enum ViewTypes {
  GRID = 'grid',
  FORM = 'form',
  GALLERY = 'gallery',
  KANBAN = 'kanban',
  CALENDAR = 'calendar',
}

/**
 * View lock types
 */
export type ViewLockType = 'collaborative' | 'locked' | 'personal';

/**
 * View definition
 */
export interface View {
  id: string;
  title: string;
  type: ViewTypes;
  fk_model_id: string;
  order?: number;
  show_system_fields?: boolean;
  lock_type?: ViewLockType;
  meta?: Record<string, unknown>;
}
