/**
 * Component/Logic Registry
 * 
 * Central registry for node types, their components, and executors.
 */

import type {
  FlowNodeTypes,
  NodeRegistration,
  NodeExecutor,
  FlowNodeProps,
} from '../types';

/**
 * Node registry singleton
 */
class NodeRegistry {
  private registrations: Map<FlowNodeTypes, NodeRegistration> = new Map();

  /**
   * Register a node type
   */
  register(registration: NodeRegistration): void {
    this.registrations.set(registration.type, registration);
  }

  /**
   * Register multiple node types
   */
  registerAll(registrations: NodeRegistration[]): void {
    registrations.forEach((reg) => this.register(reg));
  }

  /**
   * Get a node registration by type
   */
  get(type: FlowNodeTypes): NodeRegistration | undefined {
    return this.registrations.get(type);
  }

  /**
   * Get all registered node types
   */
  getAll(): NodeRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Get nodes by category
   */
  getByCategory(): Map<string, NodeRegistration[]> {
    const categories = new Map<string, NodeRegistration[]>();
    
    this.registrations.forEach((reg) => {
      const category = reg.category || 'Other';
      const list = categories.get(category) || [];
      list.push(reg);
      categories.set(category, list);
    });

    return categories;
  }

  /**
   * Check if a node type is registered
   */
  has(type: FlowNodeTypes): boolean {
    return this.registrations.has(type);
  }

  /**
   * Get executor for a node type
   */
  getExecutor<T extends FlowNodeProps>(type: FlowNodeTypes): NodeExecutor<T> | undefined {
    const reg = this.registrations.get(type);
    return reg?.executor as NodeExecutor<T> | undefined;
  }

  /**
   * Unregister a node type
   */
  unregister(type: FlowNodeTypes): boolean {
    return this.registrations.delete(type);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
  }
}

// Export singleton instance
export const nodeRegistry = new NodeRegistry();

// Export class for testing
export { NodeRegistry };
