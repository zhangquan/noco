/**
 * Flow Edge Class
 * Represents a connection between two nodes in the flow graph
 * @module core/Edge
 */

import { ulid } from 'ulid';
import type { EdgeData, EdgeType } from '../types';

// ============================================================================
// Edge Class
// ============================================================================

/**
 * Edge class - represents a connection between nodes
 */
export class Edge implements EdgeData {
  readonly id: string;
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
  type: EdgeType;
  label?: string;
  condition?: string;
  meta?: Record<string, unknown>;
  disabled?: boolean;

  constructor(data: Partial<EdgeData> & {
    sourceId: string;
    sourcePort: string;
    targetId: string;
    targetPort: string;
  }) {
    this.id = data.id || ulid();
    this.sourceId = data.sourceId;
    this.sourcePort = data.sourcePort;
    this.targetId = data.targetId;
    this.targetPort = data.targetPort;
    this.type = data.type || 'default';
    this.label = data.label;
    this.condition = data.condition;
    this.meta = data.meta;
    this.disabled = data.disabled;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create an edge from JSON data
   */
  static fromJSON(data: EdgeData): Edge {
    return new Edge(data);
  }

  /**
   * Create a simple edge between two nodes
   */
  static create(
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string,
    type: EdgeType = 'default'
  ): Edge {
    return new Edge({
      sourceId,
      sourcePort,
      targetId,
      targetPort,
      type,
    });
  }

  /**
   * Create a conditional edge
   */
  static createConditional(
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string,
    condition: string,
    label?: string
  ): Edge {
    return new Edge({
      sourceId,
      sourcePort,
      targetId,
      targetPort,
      type: 'conditional',
      condition,
      label,
    });
  }

  /**
   * Create an error handling edge
   */
  static createError(
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string,
    label?: string
  ): Edge {
    return new Edge({
      sourceId,
      sourcePort,
      targetId,
      targetPort,
      type: 'error',
      label: label || 'On Error',
    });
  }

  // ==========================================================================
  // Edge Properties
  // ==========================================================================

  /**
   * Check if this edge connects to a specific node
   */
  connectsTo(nodeId: string): boolean {
    return this.sourceId === nodeId || this.targetId === nodeId;
  }

  /**
   * Check if this edge comes from a specific node
   */
  comesFrom(nodeId: string): boolean {
    return this.sourceId === nodeId;
  }

  /**
   * Check if this edge goes to a specific node
   */
  goesTo(nodeId: string): boolean {
    return this.targetId === nodeId;
  }

  /**
   * Check if this edge uses a specific port
   */
  usesPort(portId: string): boolean {
    return this.sourcePort === portId || this.targetPort === portId;
  }

  /**
   * Check if edge is conditional
   */
  get isConditional(): boolean {
    return this.type === 'conditional';
  }

  /**
   * Check if edge is error handler
   */
  get isErrorHandler(): boolean {
    return this.type === 'error';
  }

  /**
   * Check if edge is loop
   */
  get isLoop(): boolean {
    return this.type === 'loop';
  }

  /**
   * Check if edge creates a cycle (source and target are same)
   */
  get isSelfLoop(): boolean {
    return this.sourceId === this.targetId;
  }

  // ==========================================================================
  // Edge Methods
  // ==========================================================================

  /**
   * Update edge type
   */
  setType(type: EdgeType): void {
    this.type = type;
  }

  /**
   * Update edge label
   */
  setLabel(label: string): void {
    this.label = label;
  }

  /**
   * Update condition expression
   */
  setCondition(condition: string): void {
    this.condition = condition;
    if (this.type !== 'conditional') {
      this.type = 'conditional';
    }
  }

  /**
   * Clear condition
   */
  clearCondition(): void {
    this.condition = undefined;
    if (this.type === 'conditional') {
      this.type = 'default';
    }
  }

  /**
   * Enable the edge
   */
  enable(): void {
    this.disabled = false;
  }

  /**
   * Disable the edge
   */
  disable(): void {
    this.disabled = true;
  }

  /**
   * Toggle edge enabled state
   */
  toggleEnabled(): void {
    this.disabled = !this.disabled;
  }

  /**
   * Update source connection
   */
  updateSource(nodeId: string, portId: string): void {
    this.sourceId = nodeId;
    this.sourcePort = portId;
  }

  /**
   * Update target connection
   */
  updateTarget(nodeId: string, portId: string): void {
    this.targetId = nodeId;
    this.targetPort = portId;
  }

  // ==========================================================================
  // Metadata Methods
  // ==========================================================================

  /**
   * Update metadata
   */
  updateMeta(meta: Record<string, unknown>): void {
    this.meta = { ...this.meta, ...meta };
  }

  /**
   * Set a single metadata value
   */
  setMetaValue(key: string, value: unknown): void {
    this.meta = { ...this.meta, [key]: value };
  }

  /**
   * Get a metadata value
   */
  getMetaValue<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.meta?.[key] as T) ?? defaultValue;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate edge configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.sourceId) {
      errors.push('Edge has no source node');
    }

    if (!this.sourcePort) {
      errors.push('Edge has no source port');
    }

    if (!this.targetId) {
      errors.push('Edge has no target node');
    }

    if (!this.targetPort) {
      errors.push('Edge has no target port');
    }

    if (this.type === 'conditional' && !this.condition) {
      errors.push('Conditional edge has no condition expression');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): EdgeData {
    return {
      id: this.id,
      sourceId: this.sourceId,
      sourcePort: this.sourcePort,
      targetId: this.targetId,
      targetPort: this.targetPort,
      type: this.type,
      label: this.label,
      condition: this.condition,
      meta: this.meta ? { ...this.meta } : undefined,
      disabled: this.disabled,
    };
  }

  /**
   * Clone the edge with a new ID
   */
  clone(newSourceId?: string, newTargetId?: string): Edge {
    const data = this.toJSON();
    return new Edge({
      ...data,
      id: ulid(),
      sourceId: newSourceId || data.sourceId,
      targetId: newTargetId || data.targetId,
    });
  }
}

export default Edge;
