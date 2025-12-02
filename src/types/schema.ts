/**
 * Schema description types for AI understanding
 * @module types/schema
 */

import type { Column, Table } from './column';

// ============================================================================
// Relationship Description
// ============================================================================

/**
 * Relationship type
 */
export type RelationType = 'mm' | 'hm' | 'bt';

/**
 * Relationship description for AI understanding
 */
export interface RelationshipInfo {
  /** Link column ID */
  columnId: string;
  /** Link column title */
  columnTitle: string;
  /** Related table ID */
  relatedTableId: string;
  /** Related table title */
  relatedTableTitle: string;
  /** Relationship type: mm (many-to-many), hm (has-many), bt (belongs-to) */
  type: RelationType;
  /** Description of the relationship */
  description?: string;
}

// ============================================================================
// Schema Description
// ============================================================================

/**
 * Complete schema description for a table
 */
export interface SchemaDescription {
  /** Table definition */
  table: {
    id: string;
    title: string;
    description?: string;
    hints?: string[];
  };
  /** All columns with their details */
  columns: {
    id: string;
    title: string;
    type: string;
    description?: string;
    required: boolean;
    examples?: unknown[];
    constraints?: Column['constraints'];
  }[];
  /** Relationships to other tables */
  relationships: RelationshipInfo[];
}

/**
 * Table overview for describeAllTables()
 */
export interface TableOverview {
  id: string;
  title: string;
  description?: string;
  columnCount: number;
  relationCount: number;
}
