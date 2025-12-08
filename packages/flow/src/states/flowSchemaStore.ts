/**
 * Flow Schema Store
 * Zustand store for managing flow schema state
 * Uses FlowGraph from @workspace/flow-designer
 * @module states/flowSchemaStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FlowSchema,
  NodeData,
  EdgeData,
  NodePosition,
} from '@workspace/flow-designer';
import type {
  DesignerMode,
  DesignerConfig,
  NodeSelectionState,
  ViewportState,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface FlowSchemaState {
  // Schema state
  schema: FlowSchema | null;
  originalSchema: FlowSchema | null;
  isDirty: boolean;

  // Selection state
  selection: NodeSelectionState;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;

  // Viewport state
  viewport: ViewportState;

  // UI state
  mode: DesignerMode;

  // Config
  config: DesignerConfig;

  // Actions - Schema
  setSchema: (schema: FlowSchema | null) => void;
  resetSchema: () => void;
  markDirty: () => void;
  markClean: () => void;
  updateSchema: (updates: Partial<FlowSchema>) => void;

  // Actions - Node CRUD
  addNode: (node: NodeData) => void;
  updateNode: (nodeId: string, updates: Partial<NodeData>) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  moveNode: (nodeId: string, position: NodePosition) => void;
  deleteNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => string | null;

  // Actions - Edge CRUD
  addEdge: (edge: EdgeData) => void;
  updateEdge: (edgeId: string, updates: Partial<EdgeData>) => void;
  deleteEdge: (edgeId: string) => void;

  // Actions - Selection
  selectNode: (nodeId: string, addToSelection?: boolean) => void;
  selectNodes: (nodeIds: string[]) => void;
  deselectNode: (nodeId: string) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  setHoveredEdge: (edgeId: string | null) => void;

  // Actions - Viewport
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  resetViewport: () => void;

  // Actions - UI
  setMode: (mode: DesignerMode) => void;
  setConfig: (config: Partial<DesignerConfig>) => void;

  // Getters
  getNode: (nodeId: string) => NodeData | undefined;
  getEdge: (edgeId: string) => EdgeData | undefined;
  getSelectedNodes: () => NodeData[];
  getConnectedEdges: (nodeId: string) => EdgeData[];
  getIncomingEdges: (nodeId: string) => EdgeData[];
  getOutgoingEdges: (nodeId: string) => EdgeData[];
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_VIEWPORT: ViewportState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

const DEFAULT_SELECTION: NodeSelectionState = {
  selectedIds: [],
  lastSelectedId: null,
};

const DEFAULT_CONFIG: DesignerConfig = {
  mode: 'edit',
  enableHistory: true,
  maxHistorySteps: 50,
  enableZoom: true,
  minZoom: 0.25,
  maxZoom: 2,
  enableMinimap: false,
  enableGrid: true,
  gridSize: 20,
  snapToGrid: true,
  enableMultiSelect: true,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useFlowSchemaStore = create<FlowSchemaState>()(
  immer((set, get) => ({
    // Initial state
    schema: null,
    originalSchema: null,
    isDirty: false,
    selection: DEFAULT_SELECTION,
    hoveredNodeId: null,
    hoveredEdgeId: null,
    viewport: DEFAULT_VIEWPORT,
    mode: 'edit',
    config: DEFAULT_CONFIG,

    // Schema actions
    setSchema: (schema) =>
      set((state) => {
        state.schema = schema;
        state.originalSchema = schema ? JSON.parse(JSON.stringify(schema)) : null;
        state.isDirty = false;
        state.selection = DEFAULT_SELECTION;
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

    updateSchema: (updates) =>
      set((state) => {
        if (!state.schema) return;
        Object.assign(state.schema, updates);
        state.isDirty = true;
      }),

    // Node CRUD
    addNode: (node) =>
      set((state) => {
        if (!state.schema) return;
        state.schema.nodes.push(node);
        state.isDirty = true;
      }),

    updateNode: (nodeId, updates) =>
      set((state) => {
        if (!state.schema) return;
        const index = state.schema.nodes.findIndex((n) => n.id === nodeId);
        if (index === -1) return;
        Object.assign(state.schema.nodes[index], updates);
        state.isDirty = true;
      }),

    updateNodeConfig: (nodeId, config) =>
      set((state) => {
        if (!state.schema) return;
        const node = state.schema.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        node.config = { ...node.config, ...config };
        state.isDirty = true;
      }),

    moveNode: (nodeId, position) =>
      set((state) => {
        if (!state.schema) return;
        const node = state.schema.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        node.position = position;
        state.isDirty = true;
      }),

    deleteNode: (nodeId) =>
      set((state) => {
        if (!state.schema) return;
        // Remove node
        state.schema.nodes = state.schema.nodes.filter((n) => n.id !== nodeId);
        // Remove connected edges
        state.schema.edges = state.schema.edges.filter(
          (e) => e.sourceId !== nodeId && e.targetId !== nodeId
        );
        // Update selection
        state.selection.selectedIds = state.selection.selectedIds.filter((id) => id !== nodeId);
        if (state.selection.lastSelectedId === nodeId) {
          state.selection.lastSelectedId = state.selection.selectedIds[0] || null;
        }
        state.isDirty = true;
      }),

    duplicateNode: (nodeId) => {
      const state = get();
      if (!state.schema) return null;

      const node = state.schema.nodes.find((n) => n.id === nodeId);
      if (!node) return null;

      const newId = `${node.id}-copy-${Date.now()}`;
      const newNode: NodeData = {
        ...JSON.parse(JSON.stringify(node)),
        id: newId,
        label: `${node.label} (copy)`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
      };

      set((s) => {
        if (!s.schema) return;
        s.schema.nodes.push(newNode);
        s.isDirty = true;
      });

      return newId;
    },

    // Edge CRUD
    addEdge: (edge) =>
      set((state) => {
        if (!state.schema) return;
        // Check if edge already exists
        const exists = state.schema.edges.some(
          (e) =>
            e.sourceId === edge.sourceId &&
            e.sourcePort === edge.sourcePort &&
            e.targetId === edge.targetId &&
            e.targetPort === edge.targetPort
        );
        if (!exists) {
          state.schema.edges.push(edge);
          state.isDirty = true;
        }
      }),

    updateEdge: (edgeId, updates) =>
      set((state) => {
        if (!state.schema) return;
        const index = state.schema.edges.findIndex((e) => e.id === edgeId);
        if (index === -1) return;
        Object.assign(state.schema.edges[index], updates);
        state.isDirty = true;
      }),

    deleteEdge: (edgeId) =>
      set((state) => {
        if (!state.schema) return;
        state.schema.edges = state.schema.edges.filter((e) => e.id !== edgeId);
        state.isDirty = true;
      }),

    // Selection actions
    selectNode: (nodeId, addToSelection = false) =>
      set((state) => {
        if (addToSelection && state.config.enableMultiSelect) {
          if (!state.selection.selectedIds.includes(nodeId)) {
            state.selection.selectedIds.push(nodeId);
          }
        } else {
          state.selection.selectedIds = [nodeId];
        }
        state.selection.lastSelectedId = nodeId;
      }),

    selectNodes: (nodeIds) =>
      set((state) => {
        state.selection.selectedIds = nodeIds;
        state.selection.lastSelectedId = nodeIds[nodeIds.length - 1] || null;
      }),

    deselectNode: (nodeId) =>
      set((state) => {
        state.selection.selectedIds = state.selection.selectedIds.filter((id) => id !== nodeId);
        if (state.selection.lastSelectedId === nodeId) {
          state.selection.lastSelectedId = state.selection.selectedIds[0] || null;
        }
      }),

    clearSelection: () =>
      set((state) => {
        state.selection = DEFAULT_SELECTION;
      }),

    setHoveredNode: (nodeId) =>
      set((state) => {
        state.hoveredNodeId = nodeId;
      }),

    setHoveredEdge: (edgeId) =>
      set((state) => {
        state.hoveredEdgeId = edgeId;
      }),

    // Viewport actions
    setZoom: (zoom) =>
      set((state) => {
        const { minZoom = 0.25, maxZoom = 2 } = state.config;
        state.viewport.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
      }),

    setPan: (panX, panY) =>
      set((state) => {
        state.viewport.panX = panX;
        state.viewport.panY = panY;
      }),

    resetViewport: () =>
      set((state) => {
        state.viewport = DEFAULT_VIEWPORT;
      }),

    // UI actions
    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    setConfig: (config) =>
      set((state) => {
        state.config = { ...state.config, ...config };
      }),

    // Getters
    getNode: (nodeId) => {
      const state = get();
      return state.schema?.nodes.find((n) => n.id === nodeId);
    },

    getEdge: (edgeId) => {
      const state = get();
      return state.schema?.edges.find((e) => e.id === edgeId);
    },

    getSelectedNodes: () => {
      const state = get();
      if (!state.schema) return [];
      return state.schema.nodes.filter((n) => state.selection.selectedIds.includes(n.id));
    },

    getConnectedEdges: (nodeId) => {
      const state = get();
      if (!state.schema) return [];
      return state.schema.edges.filter(
        (e) => e.sourceId === nodeId || e.targetId === nodeId
      );
    },

    getIncomingEdges: (nodeId) => {
      const state = get();
      if (!state.schema) return [];
      return state.schema.edges.filter((e) => e.targetId === nodeId);
    },

    getOutgoingEdges: (nodeId) => {
      const state = get();
      if (!state.schema) return [];
      return state.schema.edges.filter((e) => e.sourceId === nodeId);
    },
  }))
);

export default useFlowSchemaStore;
