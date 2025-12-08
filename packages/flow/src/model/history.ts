/**
 * History Manager
 * 
 * Manages undo/redo history for flow schema changes.
 */

import type { FlowSchemaType } from '../types';

export interface HistoryState {
  past: FlowSchemaType[];
  present: FlowSchemaType | null;
  future: FlowSchemaType[];
}

export interface HistoryOptions {
  /** Maximum number of history entries to keep */
  maxHistory?: number;
  /** Debounce time in ms for grouping rapid changes */
  debounceMs?: number;
}

const DEFAULT_OPTIONS: Required<HistoryOptions> = {
  maxHistory: 50,
  debounceMs: 500,
};

/**
 * History manager class
 */
export class HistoryManager {
  private past: FlowSchemaType[] = [];
  private present: FlowSchemaType | null = null;
  private future: FlowSchemaType[] = [];
  private options: Required<HistoryOptions>;
  private lastPushTime: number = 0;

  constructor(
    initialState: FlowSchemaType | null = null,
    options: HistoryOptions = {}
  ) {
    this.present = initialState;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Push a new state to history
   */
  push(state: FlowSchemaType): void {
    const now = Date.now();
    const shouldDebounce = now - this.lastPushTime < this.options.debounceMs;

    if (this.present) {
      if (shouldDebounce && this.past.length > 0) {
        // Replace last entry instead of adding new one
      } else {
        this.past.push(this.present);
        
        // Trim history if it exceeds max
        if (this.past.length > this.options.maxHistory) {
          this.past.shift();
        }
      }
    }

    this.present = state;
    this.future = []; // Clear future on new changes
    this.lastPushTime = now;
  }

  /**
   * Undo to previous state
   */
  undo(): FlowSchemaType | null {
    if (this.past.length === 0) {
      return null;
    }

    const previous = this.past.pop()!;
    
    if (this.present) {
      this.future.unshift(this.present);
    }
    
    this.present = previous;
    return this.present;
  }

  /**
   * Redo to next state
   */
  redo(): FlowSchemaType | null {
    if (this.future.length === 0) {
      return null;
    }

    const next = this.future.shift()!;
    
    if (this.present) {
      this.past.push(this.present);
    }
    
    this.present = next;
    return this.present;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Get current state
   */
  getCurrent(): FlowSchemaType | null {
    return this.present;
  }

  /**
   * Get history state (for persistence)
   */
  getState(): HistoryState {
    return {
      past: this.past,
      present: this.present,
      future: this.future,
    };
  }

  /**
   * Restore history state (for persistence)
   */
  setState(state: HistoryState): void {
    this.past = state.past;
    this.present = state.present;
    this.future = state.future;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.past = [];
    this.future = [];
    // Keep present
  }

  /**
   * Reset with new initial state
   */
  reset(state: FlowSchemaType | null): void {
    this.past = [];
    this.present = state;
    this.future = [];
    this.lastPushTime = 0;
  }

  /**
   * Get undo stack size
   */
  get undoStackSize(): number {
    return this.past.length;
  }

  /**
   * Get redo stack size
   */
  get redoStackSize(): number {
    return this.future.length;
  }
}

// Export factory function
export function createHistoryManager(
  initialState: FlowSchemaType | null = null,
  options: HistoryOptions = {}
): HistoryManager {
  return new HistoryManager(initialState, options);
}
