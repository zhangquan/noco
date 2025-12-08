/**
 * Flow Designer Type Definitions
 * Combined types for flow graph, nodes, edges, schema, and UI components
 * @module types
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
// UI-Specific Types
// ============================================================================

/**
 * Designer mode
 */
export type DesignerMode = 'edit' | 'preview' | 'readonly';

/**
 * Node selection state
 */
export interface NodeSelectionState {
  /** Selected node IDs */
  selectedIds: string[];
  /** Last selected node ID */
  lastSelectedId: string | null;
}

/**
 * Canvas viewport state
 */
export interface ViewportState {
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Pan offset X */
  panX: number;
  /** Pan offset Y */
  panY: number;
}

/**
 * Designer configuration options
 */
export interface DesignerConfig {
  /** Designer mode */
  mode?: DesignerMode;
  /** Enable history (undo/redo) */
  enableHistory?: boolean;
  /** Maximum history steps */
  maxHistorySteps?: number;
  /** Enable zoom */
  enableZoom?: boolean;
  /** Min zoom level */
  minZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Enable minimap */
  enableMinimap?: boolean;
  /** Enable grid */
  enableGrid?: boolean;
  /** Grid size in pixels */
  gridSize?: number;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Enable multi-select */
  enableMultiSelect?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Custom node renderers */
  customNodeRenderers?: Record<string, React.ComponentType<NodeRendererProps>>;
}

/**
 * Node renderer props
 */
export interface NodeRendererProps {
  /** The node to render */
  node: NodeData;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether the node is hovered */
  hovered?: boolean;
  /** Whether the node is disabled */
  disabled?: boolean;
  /** Depth level in the tree */
  depth?: number;
  /** Click handler */
  onClick?: (nodeId: string) => void;
  /** Double click handler */
  onDoubleClick?: (nodeId: string) => void;
  /** Context menu handler */
  onContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
}

/**
 * Edge renderer props
 */
export interface EdgeRendererProps {
  /** The edge to render */
  edge: EdgeData;
  /** Source node */
  sourceNode: NodeData;
  /** Target node */
  targetNode: NodeData;
  /** Whether the edge is selected */
  selected?: boolean;
  /** Whether the edge is hovered */
  hovered?: boolean;
  /** Click handler */
  onClick?: (edgeId: string) => void;
}

/**
 * Add node menu item
 */
export interface AddNodeMenuItem {
  /** Node type */
  type: string;
  /** Display label */
  label: string;
  /** Icon */
  icon?: React.ReactNode;
  /** Description */
  description?: string;
  /** Category */
  category?: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Sub-menu items */
  children?: AddNodeMenuItem[];
}

// ============================================================================
// Setter Types
// ============================================================================

/**
 * Setter field type
 */
export type SetterFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiSelect'
  | 'expression'
  | 'tableSelect'
  | 'viewSelect'
  | 'fieldSelect'
  | 'json'
  | 'code'
  | 'filter'
  | 'sort'
  | 'keyValue';

/**
 * Setter field configuration
 */
export interface SetterFieldConfig {
  /** Field name (config key) */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: SetterFieldType;
  /** Whether required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Placeholder text */
  placeholder?: string;
  /** Help text */
  help?: string;
  /** Options for select type */
  options?: Array<{ label: string; value: unknown }>;
  /** Validation rules */
  rules?: Array<{
    type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
    value?: unknown;
    message?: string;
  }>;
  /** Dependencies on other fields */
  dependencies?: string[];
  /** Conditional visibility */
  visible?: (config: Record<string, unknown>) => boolean;
  /** Support expression binding */
  supportExpression?: boolean;
}

/**
 * Setter panel configuration for a node type
 */
export interface SetterConfig {
  /** Node type */
  nodeType: string;
  /** Panel title */
  title: string;
  /** Field configurations */
  fields: SetterFieldConfig[];
  /** Custom renderer */
  customRenderer?: React.ComponentType<SetterProps>;
}

/**
 * Setter component props
 */
export interface SetterProps {
  /** Current node */
  node: NodeData;
  /** Config change handler */
  onConfigChange: (config: Record<string, unknown>) => void;
  /** Available tables (for table selection) */
  tables?: Array<{ id: string; title: string }>;
  /** Setter config */
  config?: SetterConfig;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// Expression Types (for property binding)
// ============================================================================

/**
 * Expression binding type for dynamic values
 */
export interface ExpressionType {
  /** Fixed identifier */
  type: 'expression';
  /** Expression value, e.g., '{{trigger.data.fieldName}}' */
  value: string;
  /** Display label (optional) */
  label?: string;
}

/**
 * Check if a value is an expression type
 */
export function isExpression(value: unknown): value is ExpressionType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as ExpressionType).type === 'expression'
  );
}

/**
 * Available variables for expressions
 */
export interface ExpressionVariable {
  /** Variable path */
  path: string;
  /** Variable type */
  type: string;
  /** Source node/context */
  source: string;
  /** Description */
  description?: string;
}

// ============================================================================
// UI Event Types
// ============================================================================

/**
 * UI event types
 */
export type UIEventType =
  | 'node:select'
  | 'node:deselect'
  | 'edge:select'
  | 'edge:deselect'
  | 'canvas:click'
  | 'canvas:pan'
  | 'canvas:zoom'
  | 'history:undo'
  | 'history:redo'
  | 'schema:save'
  | 'schema:load';

/**
 * UI event payload
 */
export interface UIEvent<T = unknown> {
  /** Event type */
  type: UIEventType;
  /** Event payload */
  payload?: T;
  /** Event timestamp */
  timestamp: number;
}

/**
 * UI event handler type
 */
export type UIEventHandler<T = unknown> = (event: UIEvent<T>) => void;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Type Aliases for backward compatibility
// ============================================================================

export type FlowNodeCategory = NodeCategory;
export type FlowNodeType = NodeType;
export type FlowNodeData = NodeData;
export type FlowEdgeData = EdgeData;
