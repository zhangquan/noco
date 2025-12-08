/**
 * Flow Schema Store
 * 
 * Zustand store for managing flow schema state.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FlowSchemaType,
  FlowNodeType,
  FlowNodeTypes,
  FlowNodeProps,
  DesignerState,
} from '../types';
import {
  addNode,
  updateNode,
  updateNodeProps,
  removeNode,
  moveNode,
  createNode,
  createDefaultSchema,
  findNodeById,
} from '../model/logic-model';
import { HistoryManager } from '../model/history';
import { flowEvents } from '../model/custom-event';

export interface FlowSchemaStore extends DesignerState {
  // History manager
  historyManager: HistoryManager;

  // Actions
  setSchema: (schema: FlowSchemaType | null) => void;
  resetSchema: () => void;
  
  // Node operations
  selectNode: (nodeId: string | null) => void;
  addNode: (parentId: string, actionType: FlowNodeTypes, props?: FlowNodeProps, index?: number) => string;
  updateNode: (nodeId: string, updates: Partial<FlowNodeType>) => void;
  updateNodeProps: (nodeId: string, props: Partial<FlowNodeProps>) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, newIndex: number) => void;
  duplicateNode: (nodeId: string) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // View operations
  setReadonly: (readonly: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
}

export const useFlowSchemaStore = create<FlowSchemaStore>()(
  immer((set, get) => {
    const historyManager = new HistoryManager();

    return {
      // Initial state
      selectedNodeId: null,
      schema: null,
      readonly: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      history: {
        past: [],
        future: [],
      },
      historyManager,

      // Set schema
      setSchema: (schema) => {
        set((state) => {
          state.schema = schema;
          state.selectedNodeId = null;
        });
        if (schema) {
          historyManager.reset(schema);
        }
        flowEvents.emit('schema:change', { schema });
      },

      // Reset schema to default
      resetSchema: () => {
        const schema = createDefaultSchema();
        get().setSchema(schema);
      },

      // Select node
      selectNode: (nodeId) => {
        set((state) => {
          state.selectedNodeId = nodeId;
        });
        flowEvents.emit('node:select', { nodeId });
      },

      // Add node
      addNode: (parentId, actionType, props, index) => {
        const node = createNode(actionType, props);
        
        set((state) => {
          if (!state.schema) return;
          state.schema = addNode(state.schema, parentId, node, index);
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('node:add', { nodeId: node.id, parentId });
        flowEvents.emit('schema:change', { schema });

        return node.id;
      },

      // Update node
      updateNode: (nodeId, updates) => {
        set((state) => {
          if (!state.schema) return;
          state.schema = updateNode(state.schema, nodeId, updates);
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('node:update', { nodeId, changes: updates });
        flowEvents.emit('schema:change', { schema });
      },

      // Update node props
      updateNodeProps: (nodeId, props) => {
        set((state) => {
          if (!state.schema) return;
          state.schema = updateNodeProps(state.schema, nodeId, props);
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('node:update', { nodeId, changes: { props } });
        flowEvents.emit('schema:change', { schema });
      },

      // Remove node
      removeNode: (nodeId) => {
        const currentSchema = get().schema;
        if (!currentSchema) return;

        // Don't allow removing root node
        const result = findNodeById(currentSchema, nodeId);
        if (!result || result.index === -1) return;

        set((state) => {
          if (!state.schema) return;
          state.schema = removeNode(state.schema, nodeId);
          if (state.selectedNodeId === nodeId) {
            state.selectedNodeId = null;
          }
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('node:remove', { nodeId });
        flowEvents.emit('schema:change', { schema });
      },

      // Move node
      moveNode: (nodeId, newParentId, newIndex) => {
        set((state) => {
          if (!state.schema) return;
          state.schema = moveNode(state.schema, nodeId, newParentId, newIndex);
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('node:move', { nodeId, newParentId, newIndex });
        flowEvents.emit('schema:change', { schema });
      },

      // Duplicate node
      duplicateNode: (nodeId) => {
        const currentSchema = get().schema;
        if (!currentSchema) return;

        const result = findNodeById(currentSchema, nodeId);
        if (!result || result.index === -1) return;

        const { duplicateNode: duplicateNodeFn } = require('../model/logic-model');
        
        set((state) => {
          if (!state.schema) return;
          state.schema = duplicateNodeFn(state.schema, nodeId);
        });

        const schema = get().schema;
        if (schema) {
          historyManager.push(schema);
        }

        flowEvents.emit('schema:change', { schema });
      },

      // Undo
      undo: () => {
        const schema = historyManager.undo();
        if (schema) {
          set((state) => {
            state.schema = schema;
          });
          flowEvents.emit('history:undo', { schema });
          flowEvents.emit('schema:change', { schema });
        }
      },

      // Redo
      redo: () => {
        const schema = historyManager.redo();
        if (schema) {
          set((state) => {
            state.schema = schema;
          });
          flowEvents.emit('history:redo', { schema });
          flowEvents.emit('schema:change', { schema });
        }
      },

      // Check if can undo
      canUndo: () => historyManager.canUndo(),

      // Check if can redo
      canRedo: () => historyManager.canRedo(),

      // Set readonly
      setReadonly: (readonly) => {
        set((state) => {
          state.readonly = readonly;
        });
      },

      // Set zoom
      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(0.25, Math.min(2, zoom));
        });
        flowEvents.emit('designer:zoom', { zoom: get().zoom });
      },

      // Set pan
      setPan: (x, y) => {
        set((state) => {
          state.pan = { x, y };
        });
        flowEvents.emit('designer:pan', { x, y });
      },
    };
  })
);

// Selector hooks for performance
export const useSelectedNodeId = () =>
  useFlowSchemaStore((state) => state.selectedNodeId);

export const useSchema = () =>
  useFlowSchemaStore((state) => state.schema);

export const useReadonly = () =>
  useFlowSchemaStore((state) => state.readonly);

export const useZoom = () =>
  useFlowSchemaStore((state) => state.zoom);

export const usePan = () =>
  useFlowSchemaStore((state) => state.pan);
