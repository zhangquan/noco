/**
 * Flow Designer Type Definitions
 * Types for flow graph, nodes, edges, and schema
 * @module flow-designer/types
 */

// ============================================================================
// Node Types
// ============================================================================

/**
 * Node category types
 */
export type NodeCategory = 
  | 'trigger'     // Entry points (manual, schedule, webhook, etc.)
  | 'action'      // Actions (API calls, data operations, etc.)
  | 'logic'       // Logic nodes (condition, loop, switch, etc.)
  | 'transform'   // Data transformation nodes
  | 'integration' // External integrations (email, SMS, etc.)
  | 'utility';    // Utility nodes (delay, comment, etc.)

/**
 * Built-in node types
 */
export type NodeType = 
  // Trigger nodes
  | 'trigger:manual'
  | 'trigger:schedule'
  | 'trigger:webhook'
  | 'trigger:record'
  | 'trigger:form'
  // Logic nodes
  | 'logic:condition'
  | 'logic:switch'
  | 'logic:loop'
  | 'logic:parallel'
  | 'logic:merge'
  // Action nodes
  | 'action:http'
  | 'action:query'
  | 'action:create'
  | 'action:update'
  | 'action:delete'
  | 'action:script'
  // Transform nodes
  | 'transform:map'
  | 'transform:filter'
  | 'transform:reduce'
  | 'transform:template'
  | 'transform:json'
  // Integration nodes
  | 'integration:email'
  | 'integration:sms'
  | 'integration:notification'
  | 'integration:storage'
  // Utility nodes
  | 'utility:delay'
  | 'utility:comment'
  | 'utility:log'
  | 'utility:error'
  // Custom nodes
  | `custom:${string}`;

/**
 * Node port type (input/output)
 */
export type PortDirection = 'input' | 'output';

/**
 * Port data type
 */
export type PortDataType = 
  | 'any'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'date'
  | 'file'
  | 'flow';  // Control flow port

/**
 * Node port definition
 */
export interface NodePort {
  /** Port identifier */
  id: string;
  /** Port label/name */
  label: string;
  /** Port direction */
  direction: PortDirection;
  /** Port data type */
  dataType: PortDataType;
  /** Whether port accepts multiple connections */
  multiple?: boolean;
  /** Whether port is required */
  required?: boolean;
  /** Default value for the port */
  defaultValue?: unknown;
  /** Port description */
  description?: string;
}

/**
 * Node position in the canvas
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Node size in the canvas
 */
export interface NodeSize {
  width: number;
  height: number;
}

/**
 * Node configuration/parameters
 */
export interface NodeConfig {
  [key: string]: unknown;
}

/**
 * Node validation result
 */
export interface NodeValidationResult {
  valid: boolean;
  errors: NodeValidationError[];
  warnings: NodeValidationWarning[];
}

/**
 * Node validation error
 */
export interface NodeValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Node validation warning
 */
export interface NodeValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Base node data interface
 */
export interface NodeData {
  /** Unique node identifier */
  id: string;
  /** Node type */
  type: NodeType;
  /** Node category */
  category: NodeCategory;
  /** Display label */
  label: string;
  /** Node position */
  position: NodePosition;
  /** Node size (optional) */
  size?: NodeSize;
  /** Input ports */
  inputs: NodePort[];
  /** Output ports */
  outputs: NodePort[];
  /** Node configuration */
  config: NodeConfig;
  /** Node metadata */
  meta?: Record<string, unknown>;
  /** Whether node is disabled */
  disabled?: boolean;
  /** Description/notes */
  description?: string;
  /** Node version */
  version?: number;
}

// ============================================================================
// Edge Types
// ============================================================================

/**
 * Edge type
 */
export type EdgeType = 'default' | 'conditional' | 'error' | 'loop';

/**
 * Edge data interface
 */
export interface EdgeData {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  sourceId: string;
  /** Source port ID */
  sourcePort: string;
  /** Target node ID */
  targetId: string;
  /** Target port ID */
  targetPort: string;
  /** Edge type */
  type: EdgeType;
  /** Edge label (for conditional edges) */
  label?: string;
  /** Condition expression (for conditional edges) */
  condition?: string;
  /** Edge metadata */
  meta?: Record<string, unknown>;
  /** Whether edge is disabled */
  disabled?: boolean;
}

// ============================================================================
// Flow Schema Types
// ============================================================================

/**
 * Flow trigger types
 */
export type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'record' | 'form';

/**
 * Flow variable definition
 */
export interface FlowVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: PortDataType;
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
  /** Whether variable is required */
  required?: boolean;
}

/**
 * Flow input definition
 */
export interface FlowInput {
  /** Input name */
  name: string;
  /** Input type */
  type: PortDataType;
  /** Input label */
  label: string;
  /** Default value */
  defaultValue?: unknown;
  /** Whether input is required */
  required?: boolean;
  /** Input description */
  description?: string;
  /** Input validation */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: unknown[];
  };
}

/**
 * Flow output definition
 */
export interface FlowOutput {
  /** Output name */
  name: string;
  /** Output type */
  type: PortDataType;
  /** Output label */
  label: string;
  /** Output description */
  description?: string;
}

/**
 * Flow settings
 */
export interface FlowSettings {
  /** Maximum execution time (ms) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    backoffMultiplier?: number;
  };
  /** Error handling configuration */
  errorHandling?: {
    continueOnError: boolean;
    errorNodeId?: string;
  };
  /** Logging configuration */
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  /** Custom settings */
  [key: string]: unknown;
}

/**
 * Flow schema - the complete flow definition
 */
export interface FlowSchema {
  /** Schema version */
  version: string;
  /** Flow identifier */
  id: string;
  /** Flow name/title */
  name: string;
  /** Flow description */
  description?: string;
  /** Trigger type */
  triggerType: FlowTriggerType;
  /** Trigger node ID */
  triggerNodeId?: string;
  /** All nodes in the flow */
  nodes: NodeData[];
  /** All edges connecting nodes */
  edges: EdgeData[];
  /** Flow variables */
  variables?: FlowVariable[];
  /** Flow inputs */
  inputs?: FlowInput[];
  /** Flow outputs */
  outputs?: FlowOutput[];
  /** Flow settings */
  settings?: FlowSettings;
  /** Flow metadata */
  meta?: Record<string, unknown>;
  /** Created timestamp */
  createdAt?: string;
  /** Updated timestamp */
  updatedAt?: string;
}

// ============================================================================
// Node Definition Types (for node registry)
// ============================================================================

/**
 * Node definition - describes how a node type works
 */
export interface NodeDefinition {
  /** Node type identifier */
  type: NodeType;
  /** Node category */
  category: NodeCategory;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon identifier */
  icon?: string;
  /** Default label for new nodes */
  defaultLabel: string;
  /** Input port definitions */
  inputs: Omit<NodePort, 'id'>[];
  /** Output port definitions */
  outputs: Omit<NodePort, 'id'>[];
  /** Default configuration */
  defaultConfig: NodeConfig;
  /** Configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
  /** Whether node can be disabled */
  canDisable?: boolean;
  /** Whether node is singleton (only one per flow) */
  singleton?: boolean;
  /** Documentation URL */
  docsUrl?: string;
  /** Node version */
  version: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Flow validation result
 */
export interface FlowValidationResult {
  valid: boolean;
  errors: FlowValidationError[];
  warnings: FlowValidationWarning[];
}

/**
 * Flow validation error
 */
export interface FlowValidationError {
  type: 'node' | 'edge' | 'flow';
  targetId?: string;
  field?: string;
  message: string;
  code: string;
}

/**
 * Flow validation warning
 */
export interface FlowValidationWarning {
  type: 'node' | 'edge' | 'flow';
  targetId?: string;
  field?: string;
  message: string;
  code: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Flow change event types
 */
export type FlowChangeType = 
  | 'node:add'
  | 'node:update'
  | 'node:delete'
  | 'node:move'
  | 'edge:add'
  | 'edge:update'
  | 'edge:delete'
  | 'flow:update'
  | 'flow:validate';

/**
 * Flow change event
 */
export interface FlowChangeEvent {
  type: FlowChangeType;
  timestamp: number;
  data: unknown;
  previousData?: unknown;
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  NodeCategory as FlowNodeCategory,
  NodeType as FlowNodeType,
  NodeData as FlowNodeData,
  EdgeData as FlowEdgeData,
};
