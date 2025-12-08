/**
 * FlowSDK
 * React-based workflow/logic flow editor framework
 * @module index
 */

// ============================================================================
// Main Components
// ============================================================================

export { FlowDesigner, type FlowDesignerProps } from './designer';
export { FlowRender, type FlowRenderProps } from './render';
export { SetterPanel, type SetterPanelProps } from './setter';

// ============================================================================
// Node Components
// ============================================================================

export {
  BaseNode,
  EventNode,
  IfNode,
  ConditionNode,
  DataListNode,
  DataInsertNode,
  DataUpdateNode,
  DataDeleteNode,
  AddNode,
  type BaseNodeProps,
  type EventNodeComponentProps,
  type IfNodeComponentProps,
  type ConditionNodeComponentProps,
  type DataListNodeComponentProps,
  type DataInsertNodeComponentProps,
  type DataUpdateNodeComponentProps,
  type DataDeleteNodeComponentProps,
  type AddNodeProps,
} from './components';

// ============================================================================
// State Management
// ============================================================================

export {
  useFlowSchemaStore,
  useHistoryStore,
  useFlows,
  findNode,
  findNodeWithPath,
  removeNode,
  cloneNode,
  createNode,
  type FlowSchemaState,
  type HistoryState,
  type HistoryEntry,
  type FlowApiConfig,
  type CreateFlowInput,
  type UpdateFlowInput,
  type FlowListOptions,
  type UseFlowsResult,
} from './states';

// ============================================================================
// Model / Logic
// ============================================================================

export {
  // Logic model
  createFlowSchema,
  createNode as createFlowNode,
  createConditionBranch,
  createExpression,
  findNodeById,
  findNodeWithPath as findNodePath,
  findParentNode,
  getAllNodes,
  getNodeDepth,
  addNode,
  updateNode,
  updateNodeProps,
  removeNode as deleteNode,
  moveNode,
  duplicateNode,
  cloneNodeWithNewIds,
  addConditionBranch,
  updateConditionBranch,
  removeConditionBranch,
  validateSchema,
  extractExpressionVariables,
  getAvailableVariables,
  // Events
  FlowEventEmitter,
  flowEvents,
  emitNodeAdd,
  emitNodeDelete,
  emitNodeUpdate,
  emitNodeSelect,
  emitNodeMove,
  emitSchemaChange,
  emitSchemaSave,
  emitUndo,
  emitRedo,
  useFlowEvent,
  useAllFlowEvents,
  // Registry
  flowRegistry,
  registerNode,
  registerNodes,
  registerSetter,
  getNodeComponent,
  getSetterComponent,
  type NodeComponentRegistration,
  type SetterComponentRegistration,
} from './model';

// ============================================================================
// Render
// ============================================================================

export {
  nodeComponentMap,
  getNodeComponent as getRegisteredNodeComponent,
  renderNode,
} from './render';

// ============================================================================
// Setters
// ============================================================================

export {
  StringSetter,
  NumberSetter,
  SelectSetter,
  BooleanSetter,
} from './setter';

// ============================================================================
// i18n
// ============================================================================

export {
  initFlowI18n,
  changeLanguage,
  getCurrentLanguage,
  addTranslations,
  useTranslation,
  i18n,
  resources as i18nResources,
  type SupportedLanguage,
} from './lang';

// ============================================================================
// Types
// ============================================================================

export {
  // Enums
  FlowNodeTypes,
  FlowEventTypes,
  // Type guards
  isExpression,
  // Node types
  type FlowSchemaType,
  type FlowNodeType,
  type FlowConditionNodeType,
  type FlowType,
  type FlowTriggerType,
  // Props types
  type BaseNodeProps as FlowBaseNodeProps,
  type EventNodeProps,
  type DataListNodeProps,
  type DataInsertNodeProps,
  type DataUpdateNodeProps,
  type DataDeleteNodeProps,
  type ConditionNodeProps,
  type LoopNodeProps,
  type VarNodeProps,
  type FnNodeProps,
  type HttpNodeProps,
  type DelayNodeProps,
  type FlowNodePropsType,
  // Expression types
  type ExpressionType,
  type FilterType,
  type FilterOperator,
  // Context types
  type FlowContext,
  // Designer types
  type NodeSelectionState,
  type DesignerMode,
  type DesignerConfig,
  type NodeRendererProps,
  type AddNodeMenuItem,
  // Setter types
  type SetterFieldType,
  type SetterFieldConfig,
  type SetterConfig,
  type SetterProps,
  // Event types
  type FlowDesignerEventType,
  type FlowDesignerEvent,
  type FlowDesignerEventHandler,
  // Utility types
  type DeepPartial,
  type NodePath,
  type NodeWithPath,
} from './types';

// ============================================================================
// CSS (must be imported separately)
// ============================================================================

// Import './index.css' in your app

// ============================================================================
// Default Export
// ============================================================================

export default FlowDesigner;
