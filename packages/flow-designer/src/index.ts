/**
 * FlowSDK - Flow Designer
 * React-based workflow/logic flow editor framework with core graph engine
 * @module @workspace/flow-designer
 */

// ============================================================================
// Core Classes
// ============================================================================

export { Node, Edge, FlowGraph, type FlowEventListener } from './core';
export { NodeRegistry, defaultRegistry } from './registry';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Serialization
  serializeFlow,
  serializeToSchema,
  deserializeFlow,
  deserializeFromSchema,
  exportFlow,
  importFlow,
  exportFlowBase64,
  importFlowBase64,
  serializeNodes,
  serializeEdges,
  deserializeNodes,
  deserializeEdges,
  cloneSchema,
  cloneNode as cloneNodeData,
  cloneEdge,
  migrateSchema,
  type SerializeOptions,
  type DeserializeOptions,
  // Validation
  validateFlowSchema,
  validateFlow,
  FlowSchemaValidator,
  NodeDataSchema,
  EdgeDataSchema,
  FlowVariableSchema,
  FlowInputSchema,
  FlowOutputSchema,
  FlowSettingsSchema,
} from './utils';

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

export type {
  // Core types
  NodeCategory,
  NodeType,
  PortDirection,
  PortDataType,
  NodePort,
  NodePosition,
  NodeSize,
  NodeConfig,
  NodeValidationResult,
  NodeValidationError,
  NodeValidationWarning,
  NodeData,
  EdgeType,
  EdgeData,
  FlowTriggerType,
  FlowVariable,
  FlowInput,
  FlowOutput,
  FlowSettings,
  FlowSchema,
  NodeDefinition,
  FlowValidationResult,
  FlowValidationError,
  FlowValidationWarning,
  FlowChangeType,
  FlowChangeEvent,
  // UI types
  DesignerMode,
  NodeSelectionState,
  ViewportState,
  DesignerConfig,
  NodeRendererProps,
  EdgeRendererProps,
  AddNodeMenuItem,
  // Setter types
  SetterFieldType,
  SetterFieldConfig,
  SetterConfig,
  SetterProps,
  // Expression types
  ExpressionType,
  ExpressionVariable,
  // Event types
  UIEventType,
  UIEvent,
  UIEventHandler,
  // Utility types
  DeepPartial,
  // Backward compatibility aliases
  FlowNodeCategory,
  FlowNodeType,
  FlowNodeData,
  FlowEdgeData,
} from './types';

// Export isExpression as a value
export { isExpression } from './types';

// ============================================================================
// CSS (must be imported separately)
// ============================================================================

// Import './index.css' in your app

// ============================================================================
// Default Export
// ============================================================================

import { FlowDesigner } from './designer';
export default FlowDesigner;
