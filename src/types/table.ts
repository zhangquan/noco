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
  id: string;
  title: string;
  table_name: string;
  /** Is many-to-many junction table */
  mm?: boolean;
  type?: 'table' | 'view';
  meta?: Record<string, unknown>;
  columns?: Column[];
  order?: number;
  fk_base_id?: string;
  fk_project_id?: string;
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
