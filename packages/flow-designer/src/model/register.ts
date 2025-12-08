/**
 * Component/Logic Register
 * Registry for node components and setters
 * @module model/register
 */

import type React from 'react';
import type {
  FlowNodeTypes,
  NodeRendererProps,
  SetterConfig,
  SetterFieldConfig,
  AddNodeMenuItem,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node component registration
 */
export interface NodeComponentRegistration {
  /** Node type */
  type: FlowNodeTypes;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Icon component or element */
  icon?: React.ReactNode;
  /** Component to render the node */
  component: React.ComponentType<NodeRendererProps>;
  /** Setter configuration */
  setter?: SetterConfig;
  /** Category for grouping */
  category?: string;
  /** Sort order */
  order?: number;
  /** Whether this node type is hidden from add menu */
  hidden?: boolean;
  /** Whether this node can have children */
  canHaveChildren?: boolean;
  /** Allowed child node types */
  allowedChildTypes?: FlowNodeTypes[];
  /** Default props when creating this node */
  defaultProps?: Record<string, unknown>;
}

/**
 * Setter component registration
 */
export interface SetterComponentRegistration {
  /** Setter type */
  type: string;
  /** Component to render the setter */
  component: React.ComponentType<unknown>;
  /** Default props */
  defaultProps?: Record<string, unknown>;
}

// ============================================================================
// Registry Class
// ============================================================================

/**
 * Flow component registry
 */
class FlowRegistry {
  private nodeComponents: Map<FlowNodeTypes, NodeComponentRegistration>;
  private setterComponents: Map<string, SetterComponentRegistration>;
  private categories: Map<string, string>;

  constructor() {
    this.nodeComponents = new Map();
    this.setterComponents = new Map();
    this.categories = new Map();
    
    // Default categories
    this.categories.set('trigger', '触发器');
    this.categories.set('data', '数据操作');
    this.categories.set('logic', '逻辑控制');
    this.categories.set('action', '动作');
    this.categories.set('advanced', '高级');
  }

  // ==========================================================================
  // Node Component Registration
  // ==========================================================================

  /**
   * Register a node component
   */
  registerNode(registration: NodeComponentRegistration): void {
    this.nodeComponents.set(registration.type, registration);
  }

  /**
   * Unregister a node component
   */
  unregisterNode(type: FlowNodeTypes): void {
    this.nodeComponents.delete(type);
  }

  /**
   * Get a node component registration
   */
  getNode(type: FlowNodeTypes): NodeComponentRegistration | undefined {
    return this.nodeComponents.get(type);
  }

  /**
   * Get all registered node components
   */
  getAllNodes(): NodeComponentRegistration[] {
    return Array.from(this.nodeComponents.values());
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: string): NodeComponentRegistration[] {
    return Array.from(this.nodeComponents.values()).filter(
      (reg) => reg.category === category
    );
  }

  /**
   * Get node component
   */
  getNodeComponent(type: FlowNodeTypes): React.ComponentType<NodeRendererProps> | undefined {
    return this.nodeComponents.get(type)?.component;
  }

  /**
   * Check if a node type is registered
   */
  hasNode(type: FlowNodeTypes): boolean {
    return this.nodeComponents.has(type);
  }

  // ==========================================================================
  // Setter Component Registration
  // ==========================================================================

  /**
   * Register a setter component
   */
  registerSetter(registration: SetterComponentRegistration): void {
    this.setterComponents.set(registration.type, registration);
  }

  /**
   * Unregister a setter component
   */
  unregisterSetter(type: string): void {
    this.setterComponents.delete(type);
  }

  /**
   * Get a setter component registration
   */
  getSetter(type: string): SetterComponentRegistration | undefined {
    return this.setterComponents.get(type);
  }

  /**
   * Get setter component
   */
  getSetterComponent(type: string): React.ComponentType<unknown> | undefined {
    return this.setterComponents.get(type)?.component;
  }

  // ==========================================================================
  // Category Management
  // ==========================================================================

  /**
   * Register a category
   */
  registerCategory(id: string, name: string): void {
    this.categories.set(id, name);
  }

  /**
   * Get category name
   */
  getCategoryName(id: string): string {
    return this.categories.get(id) || id;
  }

  /**
   * Get all categories
   */
  getAllCategories(): Array<{ id: string; name: string }> {
    return Array.from(this.categories.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  // ==========================================================================
  // Add Node Menu Generation
  // ==========================================================================

  /**
   * Generate add node menu items
   */
  getAddNodeMenuItems(): AddNodeMenuItem[] {
    const items: AddNodeMenuItem[] = [];
    const byCategory = new Map<string, AddNodeMenuItem[]>();

    // Group by category
    for (const reg of this.nodeComponents.values()) {
      if (reg.hidden) continue;

      const category = reg.category || 'other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }

      byCategory.get(category)!.push({
        type: reg.type,
        label: reg.name,
        icon: reg.icon,
        description: reg.description,
      });
    }

    // Sort and build menu
    const categoryOrder = ['trigger', 'data', 'logic', 'action', 'advanced', 'other'];
    
    for (const categoryId of categoryOrder) {
      const categoryItems = byCategory.get(categoryId);
      if (!categoryItems || categoryItems.length === 0) continue;

      // Sort items within category
      categoryItems.sort((a, b) => {
        const regA = this.nodeComponents.get(a.type);
        const regB = this.nodeComponents.get(b.type);
        return (regA?.order || 0) - (regB?.order || 0);
      });

      items.push({
        type: categoryId as FlowNodeTypes,
        label: this.getCategoryName(categoryId),
        children: categoryItems,
      });
    }

    return items;
  }

  /**
   * Get flat list of addable node types
   */
  getAddableNodeTypes(): FlowNodeTypes[] {
    return Array.from(this.nodeComponents.values())
      .filter((reg) => !reg.hidden)
      .map((reg) => reg.type);
  }

  // ==========================================================================
  // Setter Config Helpers
  // ==========================================================================

  /**
   * Get setter config for a node type
   */
  getSetterConfig(type: FlowNodeTypes): SetterConfig | undefined {
    return this.nodeComponents.get(type)?.setter;
  }

  /**
   * Get setter fields for a node type
   */
  getSetterFields(type: FlowNodeTypes): SetterFieldConfig[] {
    return this.nodeComponents.get(type)?.setter?.fields || [];
  }

  // ==========================================================================
  // Clear
  // ==========================================================================

  /**
   * Clear all registrations
   */
  clear(): void {
    this.nodeComponents.clear();
    this.setterComponents.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global registry instance
 */
export const flowRegistry = new FlowRegistry();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Register a node component
 */
export function registerNode(registration: NodeComponentRegistration): void {
  flowRegistry.registerNode(registration);
}

/**
 * Register multiple node components
 */
export function registerNodes(registrations: NodeComponentRegistration[]): void {
  registrations.forEach((reg) => flowRegistry.registerNode(reg));
}

/**
 * Register a setter component
 */
export function registerSetter(registration: SetterComponentRegistration): void {
  flowRegistry.registerSetter(registration);
}

/**
 * Get node component by type
 */
export function getNodeComponent(type: FlowNodeTypes): React.ComponentType<NodeRendererProps> | undefined {
  return flowRegistry.getNodeComponent(type);
}

/**
 * Get setter component by type
 */
export function getSetterComponent(type: string): React.ComponentType<unknown> | undefined {
  return flowRegistry.getSetterComponent(type);
}

export default flowRegistry;
