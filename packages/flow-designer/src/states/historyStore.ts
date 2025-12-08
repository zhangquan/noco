/**
 * History Store
 * Zustand store for managing undo/redo history
 * @module states/historyStore
 */

import { create } from 'zustand';
import type { FlowSchema } from '@workspace/flow-designer';

// ============================================================================
// Types
// ============================================================================

export interface HistoryEntry {
  /** Schema snapshot */
  schema: FlowSchema;
  /** Timestamp */
  timestamp: number;
  /** Description of the change */
  description?: string;
}

export interface HistoryState {
  /** Past states (undo stack) */
  past: HistoryEntry[];
  /** Future states (redo stack) */
  future: HistoryEntry[];
  /** Maximum history length */
  maxLength: number;

  // Actions
  push: (schema: FlowSchema, description?: string) => void;
  undo: () => FlowSchema | null;
  redo: () => FlowSchema | null;
  clear: () => void;
  setMaxLength: (length: number) => void;

  // Getters
  canUndo: () => boolean;
  canRedo: () => boolean;
  getUndoDescription: () => string | undefined;
  getRedoDescription: () => string | undefined;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxLength: 50,

  push: (schema, description) =>
    set((state) => {
      const entry: HistoryEntry = {
        schema: JSON.parse(JSON.stringify(schema)),
        timestamp: Date.now(),
        description,
      };

      const newPast = [...state.past, entry];
      
      // Trim history if it exceeds max length
      if (newPast.length > state.maxLength) {
        newPast.shift();
      }

      return {
        past: newPast,
        future: [], // Clear redo stack on new action
      };
    }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return null;

    const previous = state.past[state.past.length - 1];
    
    set({
      past: state.past.slice(0, -1),
      future: [previous, ...state.future],
    });

    // Return the schema to restore (the one before the last change)
    if (state.past.length > 1) {
      return state.past[state.past.length - 2].schema;
    }
    return previous.schema;
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return null;

    const next = state.future[0];
    
    set({
      past: [...state.past, next],
      future: state.future.slice(1),
    });

    return next.schema;
  },

  clear: () =>
    set({
      past: [],
      future: [],
    }),

  setMaxLength: (length) =>
    set((state) => {
      const newPast = state.past.slice(-length);
      return {
        maxLength: length,
        past: newPast,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  getUndoDescription: () => {
    const state = get();
    if (state.past.length === 0) return undefined;
    return state.past[state.past.length - 1].description;
  },

  getRedoDescription: () => {
    const state = get();
    if (state.future.length === 0) return undefined;
    return state.future[0].description;
  },
}));

export default useHistoryStore;
