/**
 * Flow Schema Store
 * Zustand store for managing flow schema state
 * @module states/flowSchemaStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  FlowNodeTypes,
  FlowNodePropsType,
  NodePath,
  NodeWithPath,
  DesignerMode,
  DesignerConfig,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface FlowSchemaState {
  // Schema state
  schema: FlowSchemaType | null;
  originalSchema: FlowSchemaType | null;
  isDirty: boolean;

  // Selection state
  selectedNodeId: string | null;
  selectedNodePath: NodePath;
  hoveredNodeId: string | null;

  // UI state
  mode: DesignerMode;
  zoom: number;
  panOffset: { x: number; y: number };

  // Config
  config: DesignerConfig;

  // Actions - Schema
  setSchema: (schema: FlowSchemaType | null) => void;
  resetSchema: () => void;
  markDirty: () => void;
  markClean: () => void;

  // Actions - Node CRUD
  addNode: (parentId: string, node: Partial<FlowNodeType>, index?: number) => string;
  updateNode: (nodeId: string, updates: Partial<FlowNodeType>) => void;
  updateNodeProps: (nodeId: string, props: Partial<FlowNodePropsType>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, newIndex: number) => void;
  duplicateNode: (nodeId: string) => string | null;

  // Actions - Condition branches (for IF nodes)
  addConditionBranch: (ifNodeId: string, branch?: Partial<FlowConditionNodeType>) => string;
  updateConditionBranch: (ifNodeId: string, branchId: string, updates: Partial<FlowConditionNodeType>) => void;
  deleteConditionBranch: (ifNodeId: string, branchId: string) => void;
  moveConditionBranch: (ifNodeId: string, branchId: string, newIndex: number) => void;

  // Actions - Selection
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  clearSelection: () => void;

  // Actions - UI
  setMode: (mode: DesignerMode) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setConfig: (config: Partial<DesignerConfig>) => void;

  // Getters
  getNode: (nodeId: string) => FlowNodeType | null;
  getNodeWithPath: (nodeId: string) => NodeWithPath | null;
  getSelectedNode: () => FlowNodeType | null;
  getParentNode: (nodeId: string) => FlowNodeType | null;
  getNodePath: (nodeId: string) => NodePath;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a node by ID in the schema tree
 */
function findNode(
  node: FlowNodeType | FlowSchemaType | null,
  nodeId: string
): FlowNodeType | null {
  if (!node) return null;
  if (node.id === nodeId) return node as FlowNodeType;

  // Search in actions
  if (node.actions) {
    for (const action of node.actions) {
      const found = findNode(action, nodeId);
      if (found) return found;
    }
  }

  // Search in conditions (for IF nodes)
  if ('conditions' in node && node.conditions) {
    for (const condition of node.conditions) {
      if (condition.id === nodeId) return condition as unknown as FlowNodeType;
      const found = findNode(condition as unknown as FlowNodeType, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find a node with its path
 */
function findNodeWithPath(
  node: FlowNodeType | FlowSchemaType | null,
  nodeId: string,
  path: NodePath = [],
  parent?: FlowNodeType
): NodeWithPath | null {
  if (!node) return null;
  if (node.id === nodeId) {
    return { node: node as FlowNodeType, path, parent };
  }

  // Search in actions
  if (node.actions) {
    for (const action of node.actions) {
      const found = findNodeWithPath(action, nodeId, [...path, node.id], node as FlowNodeType);
      if (found) return found;
    }
  }

  // Search in conditions
  if ('conditions' in node && node.conditions) {
    for (const condition of node.conditions) {
      if (condition.id === nodeId) {
        return { node: condition as unknown as FlowNodeType, path: [...path, node.id], parent: node as FlowNodeType };
      }
      const found = findNodeWithPath(condition as unknown as FlowNodeType, nodeId, [...path, node.id], node as FlowNodeType);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Remove a node from the schema tree
 */
function removeNode(
  node: FlowNodeType | FlowSchemaType,
  nodeId: string
): boolean {
  // Check actions
  if (node.actions) {
    const index = node.actions.findIndex((a) => a.id === nodeId);
    if (index !== -1) {
      node.actions.splice(index, 1);
      return true;
    }
    for (const action of node.actions) {
      if (removeNode(action, nodeId)) return true;
    }
  }

  // Check conditions
  if ('conditions' in node && node.conditions) {
    const index = node.conditions.findIndex((c) => c.id === nodeId);
    if (index !== -1) {
      node.conditions.splice(index, 1);
      return true;
    }
    for (const condition of node.conditions) {
      if (removeNode(condition as unknown as FlowNodeType, nodeId)) return true;
    }
  }

  return false;
}

/**
 * Deep clone a node
 */
function cloneNode(node: FlowNodeType): FlowNodeType {
  const cloned: FlowNodeType = {
    ...node,
    id: nanoid(),
    props: node.props ? { ...node.props } : undefined,
    actions: node.actions?.map(cloneNode),
    conditions: node.conditions?.map((c) => ({
      ...c,
      id: nanoid(),
      props: c.props ? { ...c.props } : undefined,
      actions: c.actions.map(cloneNode),
    })),
  };
  return cloned;
}

/**
 * Create a new node with default values
 */
function createNode(nodeType: FlowNodeTypes, props?: Partial<FlowNodePropsType>): FlowNodeType {
  return {
    id: nanoid(),
    actionType: nodeType,
    props: props as FlowNodePropsType,
    actions: nodeType === FlowNodeTypes.IF ? undefined : [],
    conditions: nodeType === FlowNodeTypes.IF ? [
      {
        id: nanoid(),
        actionType: FlowNodeTypes.CONDITION,
        props: { title: '条件 1' },
        actions: [],
      },
      {
        id: nanoid(),
        actionType: FlowNodeTypes.CONDITION,
        props: { title: '默认' },
        actions: [],
      },
    ] : undefined,
  };
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useFlowSchemaStore = create<FlowSchemaState>()(
  immer((set, get) => ({
    // Initial state
    schema: null,
    originalSchema: null,
    isDirty: false,
    selectedNodeId: null,
    selectedNodePath: [],
    hoveredNodeId: null,
    mode: 'edit',
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    config: {
      enableHistory: true,
      maxHistorySteps: 50,
      enableZoom: true,
      enableMinimap: false,
    },

    // Schema actions
    setSchema: (schema) =>
      set((state) => {
        state.schema = schema;
        state.originalSchema = schema ? JSON.parse(JSON.stringify(schema)) : null;
        state.isDirty = false;
        state.selectedNodeId = null;
        state.selectedNodePath = [];
      }),

    resetSchema: () =>
      set((state) => {
        if (state.originalSchema) {
          state.schema = JSON.parse(JSON.stringify(state.originalSchema));
          state.isDirty = false;
        }
      }),

    markDirty: () =>
      set((state) => {
        state.isDirty = true;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
        if (state.schema) {
          state.originalSchema = JSON.parse(JSON.stringify(state.schema));
        }
      }),

    // Node CRUD actions
    addNode: (parentId, nodeData, index) => {
      const newId = nanoid();
      set((state) => {
        if (!state.schema) return;

        const parent = findNode(state.schema, parentId);
        if (!parent) return;

        const newNode: FlowNodeType = {
          id: newId,
          actionType: nodeData.actionType || FlowNodeTypes.EVENT,
          props: nodeData.props,
          actions: nodeData.actions || [],
          conditions: nodeData.conditions,
          ...nodeData,
        };

        if (!parent.actions) {
          parent.actions = [];
        }

        if (index !== undefined && index >= 0 && index <= parent.actions.length) {
          parent.actions.splice(index, 0, newNode);
        } else {
          parent.actions.push(newNode);
        }

        state.isDirty = true;
      });
      return newId;
    },

    updateNode: (nodeId, updates) =>
      set((state) => {
        if (!state.schema) return;

        const node = findNode(state.schema, nodeId);
        if (!node) return;

        Object.assign(node, updates);
        state.isDirty = true;
      }),

    updateNodeProps: (nodeId, props) =>
      set((state) => {
        if (!state.schema) return;

        const node = findNode(state.schema, nodeId);
        if (!node) return;

        node.props = { ...node.props, ...props } as FlowNodePropsType;
        state.isDirty = true;
      }),

    deleteNode: (nodeId) =>
      set((state) => {
        if (!state.schema) return;

        const removed = removeNode(state.schema, nodeId);
        if (removed) {
          state.isDirty = true;
          if (state.selectedNodeId === nodeId) {
            state.selectedNodeId = null;
            state.selectedNodePath = [];
          }
        }
      }),

    moveNode: (nodeId, newParentId, newIndex) =>
      set((state) => {
        if (!state.schema) return;

        // Find and remove the node
        const nodeWithPath = findNodeWithPath(state.schema, nodeId);
        if (!nodeWithPath) return;

        const nodeCopy = JSON.parse(JSON.stringify(nodeWithPath.node));
        removeNode(state.schema, nodeId);

        // Add to new parent
        const newParent = findNode(state.schema, newParentId);
        if (!newParent) return;

        if (!newParent.actions) {
          newParent.actions = [];
        }

        newParent.actions.splice(newIndex, 0, nodeCopy);
        state.isDirty = true;
      }),

    duplicateNode: (nodeId) => {
      let newId: string | null = null;
      set((state) => {
        if (!state.schema) return;

        const nodeWithPath = findNodeWithPath(state.schema, nodeId);
        if (!nodeWithPath || !nodeWithPath.parent) return;

        const parent = nodeWithPath.parent;
        const cloned = cloneNode(nodeWithPath.node);
        newId = cloned.id;

        if (!parent.actions) {
          parent.actions = [];
        }

        const index = parent.actions.findIndex((a) => a.id === nodeId);
        if (index !== -1) {
          parent.actions.splice(index + 1, 0, cloned);
        } else {
          parent.actions.push(cloned);
        }

        state.isDirty = true;
      });
      return newId;
    },

    // Condition branch actions
    addConditionBranch: (ifNodeId, branch) => {
      const newId = nanoid();
      set((state) => {
        if (!state.schema) return;

        const ifNode = findNode(state.schema, ifNodeId);
        if (!ifNode || ifNode.actionType !== FlowNodeTypes.IF) return;

        if (!ifNode.conditions) {
          ifNode.conditions = [];
        }

        const newBranch: FlowConditionNodeType = {
          id: newId,
          actionType: FlowNodeTypes.CONDITION,
          props: branch?.props || { title: `条件 ${ifNode.conditions.length + 1}` },
          actions: branch?.actions || [],
        };

        // Insert before the last (default) branch
        const insertIndex = Math.max(0, ifNode.conditions.length - 1);
        ifNode.conditions.splice(insertIndex, 0, newBranch);
        state.isDirty = true;
      });
      return newId;
    },

    updateConditionBranch: (ifNodeId, branchId, updates) =>
      set((state) => {
        if (!state.schema) return;

        const ifNode = findNode(state.schema, ifNodeId);
        if (!ifNode || !ifNode.conditions) return;

        const branch = ifNode.conditions.find((c) => c.id === branchId);
        if (!branch) return;

        Object.assign(branch, updates);
        state.isDirty = true;
      }),

    deleteConditionBranch: (ifNodeId, branchId) =>
      set((state) => {
        if (!state.schema) return;

        const ifNode = findNode(state.schema, ifNodeId);
        if (!ifNode || !ifNode.conditions) return;

        // Don't delete if only 2 branches left (need at least one condition + default)
        if (ifNode.conditions.length <= 2) return;

        const index = ifNode.conditions.findIndex((c) => c.id === branchId);
        if (index !== -1 && index < ifNode.conditions.length - 1) {
          ifNode.conditions.splice(index, 1);
          state.isDirty = true;
        }
      }),

    moveConditionBranch: (ifNodeId, branchId, newIndex) =>
      set((state) => {
        if (!state.schema) return;

        const ifNode = findNode(state.schema, ifNodeId);
        if (!ifNode || !ifNode.conditions) return;

        const currentIndex = ifNode.conditions.findIndex((c) => c.id === branchId);
        if (currentIndex === -1) return;

        // Don't move the default branch (last one)
        if (currentIndex === ifNode.conditions.length - 1) return;
        if (newIndex >= ifNode.conditions.length - 1) return;

        const [branch] = ifNode.conditions.splice(currentIndex, 1);
        ifNode.conditions.splice(newIndex, 0, branch);
        state.isDirty = true;
      }),

    // Selection actions
    selectNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
        if (nodeId && state.schema) {
          const nodeWithPath = findNodeWithPath(state.schema, nodeId);
          state.selectedNodePath = nodeWithPath?.path || [];
        } else {
          state.selectedNodePath = [];
        }
      }),

    setHoveredNode: (nodeId) =>
      set((state) => {
        state.hoveredNodeId = nodeId;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedNodeId = null;
        state.selectedNodePath = [];
      }),

    // UI actions
    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(0.25, Math.min(2, zoom));
      }),

    setPanOffset: (offset) =>
      set((state) => {
        state.panOffset = offset;
      }),

    setConfig: (config) =>
      set((state) => {
        state.config = { ...state.config, ...config };
      }),

    // Getters
    getNode: (nodeId) => {
      const state = get();
      if (!state.schema) return null;
      return findNode(state.schema, nodeId);
    },

    getNodeWithPath: (nodeId) => {
      const state = get();
      if (!state.schema) return null;
      return findNodeWithPath(state.schema, nodeId);
    },

    getSelectedNode: () => {
      const state = get();
      if (!state.schema || !state.selectedNodeId) return null;
      return findNode(state.schema, state.selectedNodeId);
    },

    getParentNode: (nodeId) => {
      const state = get();
      if (!state.schema) return null;
      const nodeWithPath = findNodeWithPath(state.schema, nodeId);
      return nodeWithPath?.parent || null;
    },

    getNodePath: (nodeId) => {
      const state = get();
      if (!state.schema) return [];
      const nodeWithPath = findNodeWithPath(state.schema, nodeId);
      return nodeWithPath?.path || [];
    },
  }))
);

// ============================================================================
// Utility Exports
// ============================================================================

export { findNode, findNodeWithPath, removeNode, cloneNode, createNode };

export default useFlowSchemaStore;
