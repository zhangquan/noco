/**
 * FlowSDK - Main Entry Point
 * 
 * A React-based workflow/logic flow editor and runtime framework.
 */

// Import global styles
import './index.css';

// ============================================================================
// Core Exports
// ============================================================================

// Designer Component
export { FlowDesigner } from './designer';
export type { FlowDesignerProps, FlowDesignerEvents } from './types';

// Render Components
export { FlowRender } from './render';
export type { FlowRenderProps } from './render';

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Enums
  FlowNodeTypes,
  FlowEventTypes,
  SchemaDomain,
  FlowVarTypes,
  FilterOperators,
  
  // Type guards
  isExpression,
} from './types';

export type {
  // Database models
  FlowType,
  SchemaDataType,
  
  // Schema types
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  
  // Expression types
  ExpressionType,
  FilterType,
  FilterGroupType,
  
  // Node props
  FlowNodeProps,
  BaseNodeProps,
  EventNodeProps,
  DataListNodeProps,
  DataInsertNodeProps,
  DataUpdateNodeProps,
  DataDeleteNodeProps,
  ConditionNodeProps,
  VarNodeProps,
  FnNodeProps,
  LoopNodeProps,
  MessageNodeProps,
  
  // Runtime types
  FlowContext,
  FlowExecutionResult,
  FlowExecutionLog,
  NodeExecutor,
  
  // Designer types
  NodeRegistration,
  SetterConfig,
  SetterType,
  DesignerState,
  
  // Utility types
  DeepPartial,
  NodePath,
  FindNodeResult,
} from './types';

// ============================================================================
// Model Exports
// ============================================================================

export {
  // Logic model operations
  generateNodeId,
  findNodeById,
  getNode,
  addNode,
  updateNode,
  updateNodeProps,
  removeNode,
  moveNode,
  cloneNode,
  duplicateNode,
  createDefaultSchema,
  createNode,
  validateSchema,
  getAllNodeIds,
  countNodes,
  
  // Registry
  nodeRegistry,
  NodeRegistry,
  
  // History
  HistoryManager,
  createHistoryManager,
  
  // Events
  flowEvents,
  EventEmitter,
  
  // Supported types
  supportedEventTypes,
  getEventTypeDefinition,
  getTableEventTypes,
  getNonTableEventTypes,
  
  supportedFunctions,
  getFunctionDefinition,
  getFunctionsByCategory,
  getFunctionCategories,
  
  supportedVarTypes,
  getVarTypeDefinition,
  getVarTypeDefaultValue,
  validateVarType,
  inferVarType,
} from './model';

export type {
  HistoryState,
  HistoryOptions,
  EventTypeDefinition,
  FunctionDefinition,
  FunctionArg,
  VarTypeDefinition,
  FlowEvents,
} from './model';

// ============================================================================
// State Management Exports
// ============================================================================

export {
  // Store
  useFlowSchemaStore,
  useSelectedNodeId,
  useSchema,
  useReadonly,
  useZoom,
  usePan,
  
  // Hooks
  useFlows,
  useFlowApps,
  useSchemaUpload,
} from './states';

export type {
  FlowSchemaStore,
  UseFlowsOptions,
  UseFlowsResult,
  UseFlowAppsOptions,
  UseFlowAppsResult,
  UseSchemaUploadOptions,
  UseSchemaUploadResult,
  FlowApp,
} from './states';

// ============================================================================
// Runtime Exports
// ============================================================================

export {
  // Flow execution
  invokeFlow,
  createFlowInvoker,
  
  // Expression handling
  resolveExpression,
  resolveValue,
  resolveObject,
  evaluateCondition,
  hasExpressions,
  
  // Runtime registration
  registerDefaultExecutors,
  registerNodeExecutor,
  unregisterNodeExecutor,
  
  // Built-in functions
  executeBuiltinFunction,
  executeCustomFunction,
  executeFnNode,
  
  // Message handling
  setMessageHandler,
  resetMessageHandler,
  executeMessageNode,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  
  // Variable operations
  getVariable,
  setVariable,
  hasVariable,
  deleteVariable,
  getVariableNames,
  executeVarNode,
  createTypedVariable,
  
  // Utilities
  deepClone,
  createFlowContext,
  mergeContext,
  formatDuration,
  sanitizeError,
  isPromise,
  withTimeout,
  withRetry,
} from './runtime';

export type {
  InvokeFlowOptions,
  DataApiInterface,
  MessageHandler,
} from './runtime';

// ============================================================================
// Component Exports
// ============================================================================

export {
  // Node components
  BaseNode,
  EventNode,
  IfNode,
  ConditionNode,
  ReqNode,
  InsertDataNode,
  UpdateDataNode,
  VarNode,
  FnNode,
  LoopNode,
  
  // Plus nodes
  AddNode,
  
  // Utilities
  getNodeIcon,
  getNodeColor,
  getNodeName,
} from './components';

export type {
  BaseNodeProps,
  EventNodeProps as EventNodeComponentProps,
  IfNodeProps,
  ConditionNodeProps as ConditionNodeComponentProps,
  ReqNodeProps,
  InsertDataNodeProps,
  UpdateDataNodeProps,
  VarNodeProps as VarNodeComponentProps,
  FnNodeProps as FnNodeComponentProps,
  LoopNodeProps as LoopNodeComponentProps,
  AddNodeProps,
} from './components';

// ============================================================================
// Setter Exports
// ============================================================================

export {
  SetterPanel,
  RenderSetter,
  RenderSetters,
  FormItem,
  Section,
  StringSetter,
  NumberSetter,
  BooleanSetter,
  SelectSetter,
  TextareaSetter,
  JsonSetter,
  ExpressionBinder,
  DataSetter,
} from './setter';

export type {
  SetterProps,
  ExpressionSetterProps,
  VariableOption,
  SelectOption,
  TableSelectorProps,
  ViewSelectorProps,
  FieldSelectorProps,
  FilterSetterProps,
  BodySetterProps,
  SetterDefinition,
  SetterRegistry,
  SetterPanelProps,
  RenderSetterProps,
  RenderSettersProps,
  FormItemProps,
  SectionProps,
} from './setter';

// ============================================================================
// Internationalization Exports
// ============================================================================

export {
  initI18n,
  changeLanguage,
  getCurrentLanguage,
  resources,
  locales,
  i18n,
} from './lang';

export type { LocaleCode } from './lang';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  NODE_TYPE_CONFIG,
  EVENT_TYPE_CONFIG,
  VAR_TYPE_CONFIG,
  FILTER_OPERATOR_CONFIG,
  ADD_NODE_MENU,
  ZOOM_LEVELS,
  EXECUTION_CONFIG,
} from './utils';

// ============================================================================
// Default Export
// ============================================================================

export { FlowDesigner as default } from './designer';
