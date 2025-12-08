/**
 * FlowSDK UI Type Definitions
 * Re-exports core types from flow-designer and adds UI-specific types
 * @module types
 */

// ============================================================================
// Re-export Core Types from flow-designer
// ============================================================================

export type {
  // Node types
  NodeCategory,
  NodeType,
  NodeData,
  NodePort,
  NodePosition,
  NodeSize,
  NodeConfig,
  NodeValidationResult,
  NodeValidationError,
  NodeValidationWarning,
  NodeDefinition,
  PortDirection,
  PortDataType,
  // Edge types
  EdgeType,
  EdgeData,
  // Flow schema types
  FlowSchema,
  FlowTriggerType,
  FlowVariable,
  FlowInput,
  FlowOutput,
  FlowSettings,
  FlowValidationResult,
  FlowValidationError,
  FlowValidationWarning,
  // Event types
  FlowChangeType,
  FlowChangeEvent,
} from '@workspace/flow-designer';

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
  node: import('@workspace/flow-designer').NodeData;
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
  edge: import('@workspace/flow-designer').EdgeData;
  /** Source node */
  sourceNode: import('@workspace/flow-designer').NodeData;
  /** Target node */
  targetNode: import('@workspace/flow-designer').NodeData;
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
  node: import('@workspace/flow-designer').NodeData;
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
// Event Types
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
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
