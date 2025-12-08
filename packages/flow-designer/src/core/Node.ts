/**
 * Flow Node Class
 * Represents a single node in the flow graph
 * @module flow-designer/core/Node
 */

import { ulid } from 'ulid';
import type {
  NodeData,
  NodeType,
  NodeCategory,
  NodePort,
  NodePosition,
  NodeSize,
  NodeConfig,
  NodeValidationResult,
  NodeValidationError,
  NodeValidationWarning,
  NodeDefinition,
} from '../types/index.js';

// ============================================================================
// Node Class
// ============================================================================

/**
 * Node class - represents a single node in the flow
 */
export class Node implements NodeData {
  readonly id: string;
  type: NodeType;
  category: NodeCategory;
  label: string;
  position: NodePosition;
  size?: NodeSize;
  inputs: NodePort[];
  outputs: NodePort[];
  config: NodeConfig;
  meta?: Record<string, unknown>;
  disabled?: boolean;
  description?: string;
  version?: number;

  constructor(data: Partial<NodeData> & { type: NodeType }) {
    this.id = data.id || ulid();
    this.type = data.type;
    this.category = data.category || this.inferCategory(data.type);
    this.label = data.label || this.getDefaultLabel(data.type);
    this.position = data.position || { x: 0, y: 0 };
    this.size = data.size;
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.config = data.config || {};
    this.meta = data.meta;
    this.disabled = data.disabled;
    this.description = data.description;
    this.version = data.version || 1;
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a node from a definition
   */
  static fromDefinition(
    definition: NodeDefinition,
    position: NodePosition = { x: 0, y: 0 },
    overrides?: Partial<NodeData>
  ): Node {
    const id = ulid();
    return new Node({
      id,
      type: definition.type,
      category: definition.category,
      label: overrides?.label || definition.defaultLabel,
      position,
      inputs: definition.inputs.map((input, index) => ({
        ...input,
        id: `${id}-input-${index}`,
      })),
      outputs: definition.outputs.map((output, index) => ({
        ...output,
        id: `${id}-output-${index}`,
      })),
      config: { ...definition.defaultConfig, ...overrides?.config },
      meta: overrides?.meta,
      disabled: overrides?.disabled,
      description: overrides?.description || definition.description,
      version: 1,
    });
  }

  /**
   * Create a node from JSON data
   */
  static fromJSON(data: NodeData): Node {
    return new Node(data);
  }

  // ==========================================================================
  // Position & Layout Methods
  // ==========================================================================

  /**
   * Move node to a new position
   */
  moveTo(x: number, y: number): void {
    this.position = { x, y };
    this.incrementVersion();
  }

  /**
   * Move node by an offset
   */
  moveBy(dx: number, dy: number): void {
    this.position = {
      x: this.position.x + dx,
      y: this.position.y + dy,
    };
    this.incrementVersion();
  }

  /**
   * Resize the node
   */
  resize(width: number, height: number): void {
    this.size = { width, height };
    this.incrementVersion();
  }

  // ==========================================================================
  // Port Methods
  // ==========================================================================

  /**
   * Get an input port by ID
   */
  getInputPort(portId: string): NodePort | undefined {
    return this.inputs.find(p => p.id === portId);
  }

  /**
   * Get an output port by ID
   */
  getOutputPort(portId: string): NodePort | undefined {
    return this.outputs.find(p => p.id === portId);
  }

  /**
   * Get a port by ID (searches both inputs and outputs)
   */
  getPort(portId: string): NodePort | undefined {
    return this.getInputPort(portId) || this.getOutputPort(portId);
  }

  /**
   * Add an input port
   */
  addInputPort(port: Omit<NodePort, 'id' | 'direction'>): NodePort {
    const newPort: NodePort = {
      ...port,
      id: `${this.id}-input-${this.inputs.length}`,
      direction: 'input',
    };
    this.inputs.push(newPort);
    this.incrementVersion();
    return newPort;
  }

  /**
   * Add an output port
   */
  addOutputPort(port: Omit<NodePort, 'id' | 'direction'>): NodePort {
    const newPort: NodePort = {
      ...port,
      id: `${this.id}-output-${this.outputs.length}`,
      direction: 'output',
    };
    this.outputs.push(newPort);
    this.incrementVersion();
    return newPort;
  }

  /**
   * Remove an input port
   */
  removeInputPort(portId: string): boolean {
    const index = this.inputs.findIndex(p => p.id === portId);
    if (index !== -1) {
      this.inputs.splice(index, 1);
      this.incrementVersion();
      return true;
    }
    return false;
  }

  /**
   * Remove an output port
   */
  removeOutputPort(portId: string): boolean {
    const index = this.outputs.findIndex(p => p.id === portId);
    if (index !== -1) {
      this.outputs.splice(index, 1);
      this.incrementVersion();
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Configuration Methods
  // ==========================================================================

  /**
   * Update node configuration
   */
  updateConfig(config: Partial<NodeConfig>): void {
    this.config = { ...this.config, ...config };
    this.incrementVersion();
  }

  /**
   * Set a single config value
   */
  setConfigValue(key: string, value: unknown): void {
    this.config[key] = value;
    this.incrementVersion();
  }

  /**
   * Get a config value
   */
  getConfigValue<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.config[key] as T) ?? defaultValue;
  }

  /**
   * Update node label
   */
  setLabel(label: string): void {
    this.label = label;
    this.incrementVersion();
  }

  /**
   * Update node description
   */
  setDescription(description: string): void {
    this.description = description;
    this.incrementVersion();
  }

  /**
   * Enable the node
   */
  enable(): void {
    this.disabled = false;
    this.incrementVersion();
  }

  /**
   * Disable the node
   */
  disable(): void {
    this.disabled = true;
    this.incrementVersion();
  }

  /**
   * Toggle node enabled state
   */
  toggleEnabled(): void {
    this.disabled = !this.disabled;
    this.incrementVersion();
  }

  // ==========================================================================
  // Metadata Methods
  // ==========================================================================

  /**
   * Update metadata
   */
  updateMeta(meta: Record<string, unknown>): void {
    this.meta = { ...this.meta, ...meta };
    this.incrementVersion();
  }

  /**
   * Set a single metadata value
   */
  setMetaValue(key: string, value: unknown): void {
    this.meta = { ...this.meta, [key]: value };
    this.incrementVersion();
  }

  /**
   * Get a metadata value
   */
  getMetaValue<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return (this.meta?.[key] as T) ?? defaultValue;
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate the node
   */
  validate(): NodeValidationResult {
    const errors: NodeValidationError[] = [];
    const warnings: NodeValidationWarning[] = [];

    // Validate required fields
    if (!this.label || this.label.trim() === '') {
      errors.push({
        field: 'label',
        message: 'Node label is required',
        code: 'LABEL_REQUIRED',
      });
    }

    // Validate required input ports have values or connections
    for (const port of this.inputs) {
      if (port.required && port.defaultValue === undefined) {
        warnings.push({
          field: `inputs.${port.id}`,
          message: `Required input port "${port.label}" has no default value`,
          code: 'PORT_NO_DEFAULT',
        });
      }
    }

    // Type-specific validation
    this.validateByType(errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Type-specific validation
   */
  private validateByType(
    errors: NodeValidationError[],
    warnings: NodeValidationWarning[]
  ): void {
    switch (this.type) {
      case 'trigger:schedule':
        if (!this.config.cron && !this.config.interval) {
          errors.push({
            field: 'config.cron',
            message: 'Schedule trigger requires cron expression or interval',
            code: 'SCHEDULE_CONFIG_REQUIRED',
          });
        }
        break;

      case 'trigger:webhook':
        // Webhook config validation
        break;

      case 'action:http':
        if (!this.config.url) {
          errors.push({
            field: 'config.url',
            message: 'HTTP action requires URL',
            code: 'HTTP_URL_REQUIRED',
          });
        }
        break;

      case 'logic:condition':
        if (!this.config.condition) {
          warnings.push({
            field: 'config.condition',
            message: 'Condition node has no condition expression',
            code: 'CONDITION_EMPTY',
          });
        }
        break;

      default:
        // No specific validation for other types
        break;
    }
  }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if node is a trigger node
   */
  get isTrigger(): boolean {
    return this.category === 'trigger';
  }

  /**
   * Check if node is a logic node
   */
  get isLogic(): boolean {
    return this.category === 'logic';
  }

  /**
   * Check if node is an action node
   */
  get isAction(): boolean {
    return this.category === 'action';
  }

  /**
   * Check if node has input ports
   */
  get hasInputs(): boolean {
    return this.inputs.length > 0;
  }

  /**
   * Check if node has output ports
   */
  get hasOutputs(): boolean {
    return this.outputs.length > 0;
  }

  /**
   * Get the center position of the node
   */
  get center(): NodePosition {
    const width = this.size?.width || 200;
    const height = this.size?.height || 80;
    return {
      x: this.position.x + width / 2,
      y: this.position.y + height / 2,
    };
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to plain object
   */
  toJSON(): NodeData {
    return {
      id: this.id,
      type: this.type,
      category: this.category,
      label: this.label,
      position: { ...this.position },
      size: this.size ? { ...this.size } : undefined,
      inputs: this.inputs.map(p => ({ ...p })),
      outputs: this.outputs.map(p => ({ ...p })),
      config: { ...this.config },
      meta: this.meta ? { ...this.meta } : undefined,
      disabled: this.disabled,
      description: this.description,
      version: this.version,
    };
  }

  /**
   * Clone the node with a new ID
   */
  clone(position?: NodePosition): Node {
    const data = this.toJSON();
    const newId = ulid();
    return new Node({
      ...data,
      id: newId,
      position: position || { x: data.position.x + 20, y: data.position.y + 20 },
      inputs: data.inputs.map((p, i) => ({ ...p, id: `${newId}-input-${i}` })),
      outputs: data.outputs.map((p, i) => ({ ...p, id: `${newId}-output-${i}` })),
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Increment the version number
   */
  private incrementVersion(): void {
    this.version = (this.version || 0) + 1;
  }

  /**
   * Infer category from node type
   */
  private inferCategory(type: NodeType): NodeCategory {
    if (type.startsWith('trigger:')) return 'trigger';
    if (type.startsWith('logic:')) return 'logic';
    if (type.startsWith('action:')) return 'action';
    if (type.startsWith('transform:')) return 'transform';
    if (type.startsWith('integration:')) return 'integration';
    if (type.startsWith('utility:')) return 'utility';
    return 'action'; // Default
  }

  /**
   * Get default label for a node type
   */
  private getDefaultLabel(type: NodeType): string {
    const typeMap: Record<string, string> = {
      'trigger:manual': 'Manual Trigger',
      'trigger:schedule': 'Schedule',
      'trigger:webhook': 'Webhook',
      'trigger:record': 'Record Event',
      'trigger:form': 'Form Submit',
      'logic:condition': 'Condition',
      'logic:switch': 'Switch',
      'logic:loop': 'Loop',
      'logic:parallel': 'Parallel',
      'logic:merge': 'Merge',
      'action:http': 'HTTP Request',
      'action:query': 'Query Data',
      'action:create': 'Create Record',
      'action:update': 'Update Record',
      'action:delete': 'Delete Record',
      'action:script': 'Script',
      'transform:map': 'Map',
      'transform:filter': 'Filter',
      'transform:reduce': 'Reduce',
      'transform:template': 'Template',
      'transform:json': 'JSON Transform',
      'integration:email': 'Send Email',
      'integration:sms': 'Send SMS',
      'integration:notification': 'Notification',
      'integration:storage': 'Storage',
      'utility:delay': 'Delay',
      'utility:comment': 'Comment',
      'utility:log': 'Log',
      'utility:error': 'Error',
    };
    return typeMap[type] || 'Node';
  }
}

export default Node;
