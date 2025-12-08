/**
 * Flow Runtime Package
 * Runtime module for workflow execution and trigger handling
 * @module @workspace/flow-runtime
 */

// Engine exports
export { ExecutionEngine } from './engine/index.js';

// Executor exports
export { ExecutorRegistry } from './executors/index.js';
export * from './executors/ExecutorRegistry.js';

// Trigger exports
export { TriggerManager } from './triggers/index.js';

// Type exports
export * from './types/index.js';

// Re-export useful types from flow-designer
export type {
  FlowSchema,
  NodeData,
  EdgeData,
  NodeType,
  NodeCategory,
  FlowTriggerType,
} from '@workspace/flow-designer';
