/**
 * FlowSDK Type Definitions
 * Core types for the workflow/logic flow editor
 * @module types
 */

// ============================================================================
// Node Types Enum
// ============================================================================

/**
 * Flow node types enumeration
 */
export enum FlowNodeTypes {
  /** Event trigger node (root node) */
  EVENT = 'event',
  /** Insert data node */
  DATAINSERT = 'dataInsert',
  /** Query/list data node */
  DATALIST = 'dataList',
  /** Update data node */
  DATAUPDATE = 'dataUpdate',
  /** Delete data node */
  DATADELETE = 'dataDelete',
  /** Conditional judgment node */
  IF = 'if',
  /** Condition branch node */
  CONDITION = 'condition',
  /** Loop node */
  LOOP = 'loop',
  /** Variable node */
  VAR = 'var',
  /** Function node */
  FN = 'fn',
  /** HTTP request node */
  HTTP = 'http',
  /** Delay node */
  DELAY = 'delay',
  /** End node */
  END = 'end',
}

/**
 * Flow event types enumeration
 */
export enum FlowEventTypes {
  /** Execute when data is created */
  INSERT = 'insert',
  /** Execute when data is updated */
  UPDATE = 'update',
  /** Execute when data is deleted */
  DELETE = 'delete',
  /** Execute on schedule (timer) */
  TIMER = 'timer',
  /** Execute on webhook call */
  WEBHOOK = 'webhook',
  /** Execute on form submission */
  FORM = 'form',
  /** Execute manually */
  MANUAL = 'manual',
}

/**
 * Flow trigger types (for backend compatibility)
 */
export type FlowTriggerType = 'manual' | 'schedule' | 'webhook' | 'record' | 'form';

// ============================================================================
// Expression Types
// ============================================================================

/**
 * Expression binding type for dynamic values
 */
export interface ExpressionType {
  /** Fixed identifier */
  type: 'expression';
  /** Expression value, e.g., '{eventData.fieldName}' */
  value: string;
  /** Display name (optional) */
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

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Comparison operators for filters
 */
export type FilterOperator =
  | 'eq'      // equals
  | 'neq'     // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'like'    // contains
  | 'nlike'   // not contains
  | 'null'    // is null
  | 'notnull' // is not null
  | 'in'      // in array
  | 'nin';    // not in array

/**
 * Filter condition type
 */
export interface FilterType {
  /** Field name */
  field: string;
  /** Comparison operator */
  op: FilterOperator;
  /** Filter value (can be expression) */
  value?: unknown | ExpressionType;
  /** Logical operator for combining filters */
  logical?: 'and' | 'or';
}

// ============================================================================
// Node Props Types
// ============================================================================

/**
 * Base node props interface
 */
export interface BaseNodeProps {
  /** Node title/description */
  title?: string;
}

/**
 * EVENT node props
 */
export interface EventNodeProps extends BaseNodeProps {
  /** Event type (insert/update/timer) */
  eventType?: FlowEventTypes;
  /** Associated table ID */
  tableId?: string;
  /** Associated view ID */
  viewId?: string;
}

/**
 * DATALIST node props
 */
export interface DataListNodeProps extends BaseNodeProps {
  /** Table ID to query */
  tableId?: string;
  /** View ID */
  viewId?: string;
  /** Filter conditions */
  filters?: FilterType[];
  /** Maximum record count */
  limit?: string | number | ExpressionType;
  /** Offset for pagination */
  offset?: string | number | ExpressionType;
  /** Sort configuration */
  sorts?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
}

/**
 * DATAINSERT node props
 */
export interface DataInsertNodeProps extends BaseNodeProps {
  /** Table ID to insert into */
  tableId?: string;
  /** View ID */
  viewId?: string;
  /** Data body (field name -> value) */
  body?: Record<string, unknown | ExpressionType>;
}

/**
 * DATAUPDATE node props
 */
export interface DataUpdateNodeProps extends BaseNodeProps {
  /** Table ID to update */
  tableId?: string;
  /** View ID */
  viewId?: string;
  /** Record ID (supports expression binding) */
  rowId?: string | ExpressionType;
  /** Update data (field name -> value) */
  body?: Record<string, unknown | ExpressionType>;
}

/**
 * DATADELETE node props
 */
export interface DataDeleteNodeProps extends BaseNodeProps {
  /** Table ID to delete from */
  tableId?: string;
  /** View ID */
  viewId?: string;
  /** Record ID (supports expression binding) */
  rowId?: string | ExpressionType;
}

/**
 * IF/CONDITION node props
 */
export interface ConditionNodeProps extends BaseNodeProps {
  /** Condition expression (supports binding) */
  expression?: ExpressionType | string;
}

/**
 * LOOP node props
 */
export interface LoopNodeProps extends BaseNodeProps {
  /** Data source to iterate */
  dataSource?: ExpressionType | string;
  /** Loop variable name */
  itemName?: string;
  /** Index variable name */
  indexName?: string;
}

/**
 * VAR node props
 */
export interface VarNodeProps extends BaseNodeProps {
  /** Variable name */
  name?: string;
  /** Variable value */
  value?: unknown | ExpressionType;
  /** Variable type */
  varType?: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

/**
 * FN node props
 */
export interface FnNodeProps extends BaseNodeProps {
  /** Function name */
  fnName?: string;
  /** Function arguments */
  args?: Array<unknown | ExpressionType>;
  /** Custom function code */
  code?: string;
}

/**
 * HTTP node props
 */
export interface HttpNodeProps extends BaseNodeProps {
  /** Request URL */
  url?: string | ExpressionType;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string | ExpressionType>;
  /** Request body */
  body?: unknown | ExpressionType;
  /** Response variable name */
  responseVar?: string;
}

/**
 * DELAY node props
 */
export interface DelayNodeProps extends BaseNodeProps {
  /** Delay duration in milliseconds */
  duration?: number | ExpressionType;
  /** Delay unit */
  unit?: 'ms' | 's' | 'm' | 'h';
}

/**
 * Union type for all node props
 */
export type FlowNodePropsType =
  | EventNodeProps
  | DataListNodeProps
  | DataInsertNodeProps
  | DataUpdateNodeProps
  | DataDeleteNodeProps
  | ConditionNodeProps
  | LoopNodeProps
  | VarNodeProps
  | FnNodeProps
  | HttpNodeProps
  | DelayNodeProps
  | BaseNodeProps;

// ============================================================================
// Node Types
// ============================================================================

/**
 * Condition branch node type (used in IF nodes)
 */
export interface FlowConditionNodeType {
  /** Branch ID */
  id: string;
  /** Fixed as 'condition' */
  actionType: FlowNodeTypes.CONDITION;
  /** Branch props */
  props?: ConditionNodeProps;
  /** Actions within this branch */
  actions: FlowNodeType[];
}

/**
 * Generic flow node type
 */
export interface FlowNodeType {
  /** Node unique identifier (nanoid) */
  id: string;
  /** Node type */
  actionType: FlowNodeTypes;
  /** Node properties (varies by type) */
  props?: FlowNodePropsType;
  /** Child action nodes (for EVENT, CONDITION, LOOP) */
  actions?: FlowNodeType[];
  /** Condition branches (only for IF nodes) */
  conditions?: FlowConditionNodeType[];
  /** X coordinate (optional, for visual layout) */
  x?: number;
  /** Y coordinate (optional) */
  y?: number;
  /** Whether node is disabled */
  disabled?: boolean;
  /** Node metadata */
  meta?: Record<string, unknown>;
}

/**
 * Flow schema type - root node schema
 * Root node must be EVENT type
 */
export interface FlowSchemaType {
  /** Node ID (nanoid) */
  id: string;
  /** Fixed as 'event' */
  actionType: FlowNodeTypes.EVENT;
  /** Event node props */
  props?: EventNodeProps;
  /** Child action nodes */
  actions?: FlowNodeType[];
}

// ============================================================================
// Flow Entity Types
// ============================================================================

/**
 * Flow entity type (database model)
 */
export interface FlowType {
  /** Flow unique identifier */
  id: string;
  /** Project ID */
  projectId: string;
  /** Group ID */
  groupId?: string;
  /** Flow title */
  title: string;
  /** Dev environment schema ID */
  schemaId?: string;
  /** Publish environment schema ID */
  publishSchemaId?: string;
  /** Trigger type */
  triggerType?: FlowTriggerType;
  /** Whether enabled */
  enabled?: boolean;
  /** Sort order */
  order?: number;
  /** Metadata */
  meta?: Record<string, unknown>;
  /** Created timestamp */
  createdAt?: Date;
  /** Updated timestamp */
  updatedAt?: Date;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Flow execution context
 */
export interface FlowContext {
  /** Event data (data when event was triggered) */
  eventData?: Record<string, unknown>;
  /** Flow data (accumulated during execution) */
  flowData?: Record<string, unknown>;
  /** Loop data (current item in loop) */
  loopData?: {
    item?: unknown;
    index?: number;
  };
  /** Global context */
  context?: {
    userId?: string;
    projectId?: string;
    timestamp?: number;
    [key: string]: unknown;
  };
}

// ============================================================================
// Designer Types
// ============================================================================

/**
 * Node selection state
 */
export interface NodeSelectionState {
  /** Selected node ID */
  selectedId: string | null;
  /** Selected node path (array of parent IDs) */
  path: string[];
}

/**
 * Designer mode
 */
export type DesignerMode = 'edit' | 'preview' | 'readonly';

/**
 * Designer config options
 */
export interface DesignerConfig {
  /** Designer mode */
  mode?: DesignerMode;
  /** Enable history (undo/redo) */
  enableHistory?: boolean;
  /** Maximum history steps */
  maxHistorySteps?: number;
  /** Available node types */
  availableNodeTypes?: FlowNodeTypes[];
  /** Custom node renderers */
  customNodeRenderers?: Record<string, React.ComponentType<NodeRendererProps>>;
  /** Enable zoom */
  enableZoom?: boolean;
  /** Enable minimap */
  enableMinimap?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

/**
 * Node renderer props
 */
export interface NodeRendererProps {
  /** The node to render */
  node: FlowNodeType;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether the node is disabled */
  disabled?: boolean;
  /** Depth level in the tree */
  depth?: number;
  /** Parent node ID */
  parentId?: string;
  /** Click handler */
  onClick?: (nodeId: string) => void;
  /** Double click handler */
  onDoubleClick?: (nodeId: string) => void;
}

/**
 * Add node menu item
 */
export interface AddNodeMenuItem {
  /** Node type */
  type: FlowNodeTypes;
  /** Display label */
  label: string;
  /** Icon */
  icon?: React.ReactNode;
  /** Description */
  description?: string;
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
  | 'sort';

/**
 * Setter field configuration
 */
export interface SetterFieldConfig {
  /** Field name (prop key) */
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
  visible?: (props: Record<string, unknown>) => boolean;
  /** Support expression binding */
  supportExpression?: boolean;
}

/**
 * Setter panel configuration
 */
export interface SetterConfig {
  /** Node type */
  nodeType: FlowNodeTypes;
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
  node: FlowNodeType;
  /** Change handler */
  onChange: (node: FlowNodeType) => void;
  /** Available tables (for table selection) */
  tables?: Array<{ id: string; title: string }>;
  /** Config */
  config?: SetterConfig;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Flow designer event types
 */
export type FlowDesignerEventType =
  | 'node:add'
  | 'node:delete'
  | 'node:update'
  | 'node:select'
  | 'node:move'
  | 'node:copy'
  | 'node:paste'
  | 'schema:change'
  | 'schema:save'
  | 'history:undo'
  | 'history:redo';

/**
 * Flow designer event payload
 */
export interface FlowDesignerEvent<T = unknown> {
  /** Event type */
  type: FlowDesignerEventType;
  /** Event payload */
  payload?: T;
  /** Event timestamp */
  timestamp: number;
}

/**
 * Event handler type
 */
export type FlowDesignerEventHandler<T = unknown> = (event: FlowDesignerEvent<T>) => void;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Node path type
 */
export type NodePath = string[];

/**
 * Node with path
 */
export interface NodeWithPath {
  node: FlowNodeType;
  path: NodePath;
  parent?: FlowNodeType;
}
