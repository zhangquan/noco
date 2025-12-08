/**
 * Page Entity
 * Pure domain entity for page
 * @module models/Page
 */

import type { Page as PageType } from '../types/index.js';

// ============================================================================
// Page Entity Class
// ============================================================================

/**
 * Page entity class - represents a page in the system
 * Contains only properties and business logic, no data access
 */
export class Page {
  private data: PageType;

  constructor(data: PageType) {
    this.data = data;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get groupId(): string | undefined { return this.data.group_id; }
  get title(): string { return this.data.title; }
  get route(): string | undefined { return this.data.route; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get order(): number { return this.data.order ?? 0; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }
  get createdAt(): Date { return this.data.created_at; }
  get updatedAt(): Date { return this.data.updated_at; }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if page has a schema
   */
  get hasSchema(): boolean {
    return !!this.schemaId;
  }

  /**
   * Check if page is published
   */
  get isPublished(): boolean {
    return !!this.publishSchemaId;
  }

  /**
   * Get the effective route (with fallback)
   */
  get effectiveRoute(): string {
    return this.route || `/${this.id}`;
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get raw data
   */
  getData(): PageType {
    return this.data;
  }

  /**
   * Convert to JSON
   */
  toJSON(): PageType {
    return { ...this.data };
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: PageType): void {
    this.data = data;
  }

  /**
   * Merge partial data
   */
  merge(data: Partial<PageType>): void {
    this.data = { ...this.data, ...data };
  }
}

export default Page;
