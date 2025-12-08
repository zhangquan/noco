/**
 * Project Entity
 * Pure domain entity for project
 * @module models/Project
 */

import type { Project as ProjectType, ProjectRole } from '../types/index.js';

// ============================================================================
// Project Entity Class
// ============================================================================

/**
 * Project entity class - represents a project in the system
 * Contains only properties and business logic, no data access
 */
export class Project {
  private data: ProjectType;
  private _role?: ProjectRole;

  constructor(data: ProjectType, role?: ProjectRole) {
    this.data = data;
    this._role = role;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.data.id; }
  get title(): string { return this.data.title; }
  get prefix(): string { return this.data.prefix; }
  get description(): string | undefined { return this.data.description; }
  get orgId(): string | undefined { return this.data.org_id; }
  get isMeta(): boolean { return this.data.is_meta ?? false; }
  get deleted(): boolean { return this.data.deleted ?? false; }
  get order(): number { return this.data.order ?? 0; }
  get color(): string | undefined { return this.data.color; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }
  get createdAt(): Date { return this.data.created_at; }
  get updatedAt(): Date { return this.data.updated_at; }

  /**
   * Get user's role in this project (if loaded)
   */
  get role(): ProjectRole | undefined { return this._role; }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if project is active (not deleted)
   */
  get isActive(): boolean {
    return !this.deleted;
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get raw data
   */
  getData(): ProjectType {
    return this.data;
  }

  /**
   * Convert to JSON
   */
  toJSON(): ProjectType & { role?: ProjectRole } {
    return { ...this.data, role: this._role };
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: ProjectType): void {
    this.data = data;
  }

  /**
   * Set user's role
   */
  setRole(role: ProjectRole): void {
    this._role = role;
  }

  /**
   * Merge partial data
   */
  merge(data: Partial<ProjectType>): void {
    this.data = { ...this.data, ...data };
  }
}

export default Project;
