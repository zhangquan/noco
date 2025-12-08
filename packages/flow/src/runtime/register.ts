/**
 * Runtime Component Registry
 * 
 * Registers runtime executors for node types.
 */

import type { FlowNodeTypes, NodeRegistration, NodeExecutor } from '../types';
import { nodeRegistry } from '../model/register';

/**
 * Register default node executors
 */
export function registerDefaultExecutors(): void {
  // Executors are built into invokeFlow.ts
  // This function is for registering custom executors
}

/**
 * Register a custom node executor
 */
export function registerNodeExecutor(
  type: FlowNodeTypes,
  executor: NodeExecutor
): void {
  const existing = nodeRegistry.get(type);
  if (existing) {
    nodeRegistry.register({
      ...existing,
      executor,
    });
  } else {
    nodeRegistry.register({
      type,
      name: type,
      executor,
    });
  }
}

/**
 * Unregister a node executor
 */
export function unregisterNodeExecutor(type: FlowNodeTypes): void {
  const existing = nodeRegistry.get(type);
  if (existing) {
    nodeRegistry.register({
      ...existing,
      executor: undefined,
    });
  }
}
