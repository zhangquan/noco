/**
 * Flow Designer Package
 * Design-time module for visual workflow design and schema management
 * @module @workspace/flow-designer
 */

// Core exports
export { Node, Edge, FlowGraph } from './core/index.js';
export type { FlowEventListener } from './core/index.js';

// Registry exports
export { NodeRegistry, defaultRegistry } from './registry/index.js';
export * from './registry/NodeRegistry.js';

// Utility exports
export * from './utils/index.js';

// Type exports
export * from './types/index.js';
