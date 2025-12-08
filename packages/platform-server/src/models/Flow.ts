/**
 * Flow Entity
 * Pure domain entity for flow/workflow
 * @module models/Flow
 */

import type { Flow as FlowType, FlowTriggerType } from '../types/index.js';

// ============================================================================
// Flow Entity Class
// ============================================================================

/**
 * Flow entity class - represents a workflow in the system
 * Contains only properties and business logic, no data access
 */
export class Flow {
  private data: FlowType;

  constructor(data: FlowType) {
    this.data = data;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get groupId(): string | undefined { return this.data.group_id; }
  get title(): string { return this.data.title; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get triggerType(): FlowTriggerType { return this.data.trigger_type ?? 'manual'; }
  get enabled(): boolean { return this.data.enabled ?? true; }
  get order(): number { return this.data.order ?? 0; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }
  get createdAt(): Date { return this.data.created_at; }
  get updatedAt(): Date { return this.data.updated_at; }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if flow has a schema
   */
  get hasSchema(): boolean {
    return !!this.schemaId;
  }

  /**
   * Check if flow is published
   */
  get isPublished(): boolean {
    return !!this.publishSchemaId;
  }

  /**
   * Check if flow is active (enabled)
   */
  get isActive(): boolean {
    return this.enabled;
  }

  /**
   * Check if flow is manual trigger
   */
  get isManual(): boolean {
    return this.triggerType === 'manual';
  }

  /**
   * Check if flow is scheduled
   */
  get isScheduled(): boolean {
    return this.triggerType === 'schedule';
  }

  /**
   * Check if flow is webhook triggered
   */
  get isWebhook(): boolean {
    return this.triggerType === 'webhook';
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get raw data
   */
  getData(): FlowType {
    return this.data;
  }

  /**
   * Convert to JSON
   */
  toJSON(): FlowType {
    return { ...this.data };
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: FlowType): void {
    this.data = data;
  }

  /**
   * Merge partial data
   */
  merge(data: Partial<FlowType>): void {
    this.data = { ...this.data, ...data };
  }
}

export default Flow;
