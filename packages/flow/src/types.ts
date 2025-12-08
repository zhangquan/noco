/**
 * FlowSDK Type Definitions
 * 
 * This file contains all TypeScript type definitions for the Flow system,
 * including database models, schema types, and runtime types.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Node types available in the flow editor
 */
export enum FlowNodeTypes {
  /** Event trigger node (root node) */
  EVENT = 'event',
  /** Insert data node */
  DATAINSERT = 'dataInsert',
  /** Request/query data node */
  DATALIST = 'dataList',
  /** Update data node */
  DATAUPDATE = 'dataUpdate',
  /** Delete data node */
  DATADELETE = 'dataDelete',
  /** Conditional branch node */
  IF = 'if',
  /** Condition branch node */
  CONDITION = 'condition',
  /** Variable node */
  VAR = 'var',
  /** Function node */
  FN = 'fn',
  /** Loop node */
  LOOP = 'loop',
  /** Message/notification node */
  MESSAGE = 'message',
}

/**
 * Event types that can trigger a flow
 */
export enum FlowEventTypes {
  /** Triggered when data is created */
  INSERT = 'insert',
  /** Triggered when data is updated */
  UPDATE = 'update',
  /** Triggered when data is deleted */
  DELETE = 'delete',
  /** Triggered on a schedule (timer) */
  TIMER = 'timer',
  /** Triggered manually */
  MANUAL = 'manual',
  /** Triggered by webhook */
  WEBHOOK = 'webhook',
}

/**
 * Schema domain types for data storage
 */
export enum SchemaDomain {
  /** Flow schema */
  FLOW = 'flow',
  /** Page schema */
  PAGE = 'page',
  /** Component schema */
  COMPONENT = 'component',
}

/**
 * Variable types supported in flows
 */
export enum FlowVarTypes {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  DATE = 'date',
  NULL = 'null',
}

/**
 * Filter operation types
 */
export enum FilterOperators {
  EQ = 'eq',
  NEQ = 'neq',
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  LIKE = 'like',
  NLIKE = 'nlike',
  IS_NULL = 'isNull',
  IS_NOT_NULL = 'isNotNull',
  IN = 'in',
  NOT_IN = 'notIn',
  BETWEEN = 'between',
}

// ============================================================================
// Database Models
// ============================================================================

/**
 * Flow table model (nc_flows)
 */
export interface FlowType {
  /** Flow unique identifier (UUID) */
  id: string;
  /** Flow name */
  title: string;
  /** Sort order */
  order: number;
  /** Flow type */
  type: string;
  /** Parent app ID */
  fk_app_id: string;
  /** Development environment schema ID */
  fk_data_id?: string;
  /** Production environment schema ID */
  fk_publish_data_id?: string;
  /** Whether published */
  is_publish: boolean;
  /** Publish time */
  publish_at?: string | number | Date;
  /** Whether needs publishing */
  need_publish: boolean;
  /** Metadata */
  meta?: Record<string, unknown>;
  /** Whether deleted */
  deleted?: boolean;
  /** Created at */
  created_at?: string | Date;
  /** Updated at */
  updated_at?: string | Date;
}

/**
 * Schema data table model (nc_schema)
 */
export interface SchemaDataType {
  /** Schema unique identifier (UUID) */
  id: string;
  /** Version number */
  version: string;
  /** Schema data (JSON) */
  data?: FlowSchemaType;
  /** Domain type */
  domain: SchemaDomain;
  /** Organization ID */
  fk_org_id?: string;
  /** Project ID */
  fk_project_id?: string;
  /** Domain ID (e.g., Flow ID) */
  fk_domain_id: string;
  /** Metadata */
  meta?: Record<string, unknown>;
  /** Created at */
  created_at?: string | Date;
  /** Updated at */
  updated_at?: string | Date;
}

// ============================================================================
// Expression Types
// ============================================================================

/**
 * Expression type for dynamic value binding
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
 * Filter condition type
 */
export interface FilterType {
  /** Field name */
  field: string;
  /** Filter operator */
  op: FilterOperators | string;
  /** Filter value (can be expression) */
  value: unknown | ExpressionType;
  /** Logical operator for combining filters */
  logicalOp?: 'and' | 'or';
}

/**
 * Filter group type for complex conditions
 */
export interface FilterGroupType {
  /** Logical operator */
  logicalOp: 'and' | 'or';
  /** Child filters */
  children: (FilterType | FilterGroupType)[];
}

// ============================================================================
// Node Props Types
// ============================================================================

/**
 * Base props for all nodes
 */
export interface BaseNodeProps {
  /** Node description/title */
  title?: string;
}

/**
 * EVENT node props
 */
export interface EventNodeProps extends BaseNodeProps {
  /** Event type (insert/update/delete/timer) */
  eventType?: FlowEventTypes;
  /** Data table ID */
  tableId?: string;
  /** Data view ID */
  viewId?: string;
  /** Cron expression for timer events */
  cron?: string;
  /** Webhook URL for webhook events */
  webhookUrl?: string;
}

/**
 * DATALIST node props
 */
export interface DataListNodeProps extends BaseNodeProps {
  /** Data table ID */
  tableId?: string;
  /** Data view ID */
  viewId?: string;
  /** Filter conditions */
  filters?: FilterType[];
  /** Maximum record count */
  limit?: string | number | ExpressionType;
  /** Offset for pagination */
  offset?: string | number | ExpressionType;
  /** Sort configuration */
  sort?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  /** Fields to select */
  fields?: string[];
}

/**
 * DATAINSERT node props
 */
export interface DataInsertNodeProps extends BaseNodeProps {
  /** Data table ID */
  tableId?: string;
  /** Data view ID */
  viewId?: string;
  /** Data to insert (field name -> value) */
  body?: Record<string, unknown | ExpressionType>;
}

/**
 * DATAUPDATE node props
 */
export interface DataUpdateNodeProps extends BaseNodeProps {
  /** Data table ID */
  tableId?: string;
  /** Data view ID */
  viewId?: string;
  /** Record ID (supports expression binding) */
  rowId?: string | ExpressionType;
  /** Data to update (field name -> value) */
  body?: Record<string, unknown | ExpressionType>;
  /** Filter conditions for bulk update */
  filters?: FilterType[];
}

/**
 * DATADELETE node props
 */
export interface DataDeleteNodeProps extends BaseNodeProps {
  /** Data table ID */
  tableId?: string;
  /** Data view ID */
  viewId?: string;
  /** Record ID (supports expression binding) */
  rowId?: string | ExpressionType;
  /** Filter conditions for bulk delete */
  filters?: FilterType[];
}

/**
 * IF/CONDITION node props
 */
export interface ConditionNodeProps extends BaseNodeProps {
  /** Condition expression (supports binding) */
  expression?: ExpressionType | string;
}

/**
 * VAR node props
 */
export interface VarNodeProps extends BaseNodeProps {
  /** Variable name */
  name?: string;
  /** Variable type */
  varType?: FlowVarTypes;
  /** Initial value */
  value?: unknown | ExpressionType;
  /** Operation type */
  operation?: 'set' | 'increment' | 'decrement' | 'append' | 'remove';
}

/**
 * FN (function) node props
 */
export interface FnNodeProps extends BaseNodeProps {
  /** Function name */
  fnName?: string;
  /** Function arguments */
  args?: Array<unknown | ExpressionType>;
  /** Custom code for custom functions */
  code?: string;
  /** Return variable name */
  returnVar?: string;
}

/**
 * LOOP node props
 */
export interface LoopNodeProps extends BaseNodeProps {
  /** Data source to iterate */
  source?: ExpressionType | unknown[];
  /** Current item variable name */
  itemVar?: string;
  /** Current index variable name */
  indexVar?: string;
  /** Maximum iterations */
  maxIterations?: number;
}

/**
 * MESSAGE node props
 */
export interface MessageNodeProps extends BaseNodeProps {
  /** Message type */
  messageType?: 'success' | 'error' | 'warning' | 'info';
  /** Message content */
  content?: string | ExpressionType;
  /** Duration in seconds */
  duration?: number;
}

/**
 * Union type for all node props
 */
export type FlowNodeProps =
  | EventNodeProps
  | DataListNodeProps
  | DataInsertNodeProps
  | DataUpdateNodeProps
  | DataDeleteNodeProps
  | ConditionNodeProps
  | VarNodeProps
  | FnNodeProps
  | LoopNodeProps
  | MessageNodeProps
  | BaseNodeProps;

// ============================================================================
// Flow Node Types
// ============================================================================

/**
 * Condition branch node type
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
 * General flow node type
 */
export interface FlowNodeType {
  /** Node unique identifier (nanoid) */
  id: string;
  /** Node type */
  actionType: FlowNodeTypes;
  /** Node props (varies by type) */
  props?: FlowNodeProps;
  /** Child action nodes (for EVENT, LOOP) */
  actions?: FlowNodeType[];
  /** Condition branches (for IF nodes only) */
  conditions?: FlowConditionNodeType[];
  /** X coordinate (optional, for visualization) */
  x?: number;
  /** Y coordinate (optional) */
  y?: number;
}

/**
 * Flow schema type (root node, must be EVENT type)
 */
export interface FlowSchemaType {
  /** Node ID (nanoid) */
  id: string;
  /** Fixed as 'event' */
  actionType: FlowNodeTypes.EVENT;
  /** Event props */
  props?: EventNodeProps;
  /** Child action nodes */
  actions?: FlowNodeType[];
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Flow execution context
 */
export interface FlowContext {
  /** Event trigger data */
  eventData: Record<string, unknown>;
  /** Flow execution data (nodeId -> result) */
  flowData: Record<string, unknown>;
  /** Loop iteration data */
  loopData?: {
    item: unknown;
    index: number;
    array: unknown[];
  };
  /** Global context */
  context: {
    userId?: string;
    projectId?: string;
    timestamp: number;
    [key: string]: unknown;
  };
  /** Variables defined during flow execution */
  variables: Record<string, unknown>;
}

/**
 * Flow execution result
 */
export interface FlowExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error information */
  error?: {
    message: string;
    code?: string;
    nodeId?: string;
  };
  /** Execution logs */
  logs?: FlowExecutionLog[];
  /** Execution duration in ms */
  duration: number;
}

/**
 * Flow execution log entry
 */
export interface FlowExecutionLog {
  /** Log timestamp */
  timestamp: number;
  /** Node ID that generated this log */
  nodeId: string;
  /** Log level */
  level: 'info' | 'warn' | 'error' | 'debug';
  /** Log message */
  message: string;
  /** Additional data */
  data?: unknown;
}

/**
 * Node execution handler type
 */
export type NodeExecutor<T extends FlowNodeProps = FlowNodeProps> = (
  node: FlowNodeType,
  context: FlowContext,
  props: T
) => Promise<unknown>;

// ============================================================================
// Designer Types
// ============================================================================

/**
 * Node registration configuration
 */
export interface NodeRegistration {
  /** Node type */
  type: FlowNodeTypes;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Icon name or component */
  icon?: string | React.ComponentType;
  /** Category for grouping in add menu */
  category?: string;
  /** Default props for new nodes */
  defaultProps?: FlowNodeProps;
  /** Setter configuration for property panel */
  setters?: SetterConfig[];
  /** Whether node can have children */
  hasChildren?: boolean;
  /** Whether node can have conditions */
  hasConditions?: boolean;
  /** Runtime executor */
  executor?: NodeExecutor;
}

/**
 * Setter configuration for property panel
 */
export interface SetterConfig {
  /** Property name */
  name: string;
  /** Display label */
  label: string;
  /** Setter type */
  type: SetterType;
  /** Whether required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Options for select/radio setters */
  options?: Array<{ label: string; value: unknown }>;
  /** Placeholder text */
  placeholder?: string;
  /** Help text */
  help?: string;
  /** Condition to show/hide this setter */
  condition?: (props: FlowNodeProps) => boolean;
  /** Additional setter-specific props */
  props?: Record<string, unknown>;
}

/**
 * Available setter types
 */
export type SetterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'radio'
  | 'textarea'
  | 'json'
  | 'expression'
  | 'table'
  | 'view'
  | 'field'
  | 'filter'
  | 'body'
  | 'custom';

/**
 * Designer state
 */
export interface DesignerState {
  /** Current selected node ID */
  selectedNodeId: string | null;
  /** Current flow schema */
  schema: FlowSchemaType | null;
  /** Whether in readonly mode */
  readonly: boolean;
  /** Zoom level */
  zoom: number;
  /** Pan position */
  pan: { x: number; y: number };
  /** Undo/redo history */
  history: {
    past: FlowSchemaType[];
    future: FlowSchemaType[];
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Flow designer events
 */
export interface FlowDesignerEvents {
  /** Called when schema changes */
  onSchemaChange?: (schema: FlowSchemaType) => void;
  /** Called when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Called when save is requested */
  onSave?: (schema: FlowSchemaType) => Promise<void>;
  /** Called when publish is requested */
  onPublish?: (schema: FlowSchemaType) => Promise<void>;
}

/**
 * Flow designer props
 */
export interface FlowDesignerProps extends FlowDesignerEvents {
  /** Initial schema */
  schema?: FlowSchemaType;
  /** Flow ID */
  flowId?: string;
  /** Whether in readonly mode */
  readonly?: boolean;
  /** Available tables for data operations */
  tables?: Array<{ id: string; name: string }>;
  /** Available views */
  views?: Record<string, Array<{ id: string; name: string }>>;
  /** Available fields per table */
  fields?: Record<string, Array<{ id: string; name: string; type: string }>>;
  /** Custom node registrations */
  customNodes?: NodeRegistration[];
  /** Locale */
  locale?: string;
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

/**
 * Node path type (for nested node operations)
 */
export type NodePath = Array<{
  type: 'actions' | 'conditions';
  index: number;
}>;

/**
 * Find node result
 */
export interface FindNodeResult {
  node: FlowNodeType | FlowConditionNodeType;
  parent: FlowNodeType | FlowSchemaType | FlowConditionNodeType;
  path: NodePath;
  index: number;
}
