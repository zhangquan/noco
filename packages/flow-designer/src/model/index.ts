/**
 * Model Module
 * Exports all model utilities
 * @module model
 */

// Logic model
export {
  createFlowSchema,
  createNode,
  createConditionBranch,
  createExpression,
  findNodeById,
  findNodeWithPath,
  findParentNode,
  getAllNodes,
  getNodeDepth,
  addNode,
  updateNode,
  updateNodeProps,
  removeNode,
  moveNode,
  duplicateNode,
  cloneNodeWithNewIds,
  addConditionBranch,
  updateConditionBranch,
  removeConditionBranch,
  validateSchema,
  extractExpressionVariables,
  getAvailableVariables,
} from './logic-model';

// Custom events
export {
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
} from './custom-event';

// Registry
export {
  flowRegistry,
  registerNode,
  registerNodes,
  registerSetter,
  getNodeComponent,
  getSetterComponent,
  type NodeComponentRegistration,
  type SetterComponentRegistration,
} from './register';
