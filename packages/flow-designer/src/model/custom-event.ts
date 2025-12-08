/**
 * Custom Event System
 * Event emitter for flow designer events
 * @module model/custom-event
 */

import type { FlowDesignerEventType, FlowDesignerEvent, FlowDesignerEventHandler } from '../types';

// ============================================================================
// Event Emitter Class
// ============================================================================

/**
 * Flow designer event emitter
 */
export class FlowEventEmitter {
  private listeners: Map<FlowDesignerEventType, Set<FlowDesignerEventHandler>>;
  private allListeners: Set<FlowDesignerEventHandler>;

  constructor() {
    this.listeners = new Map();
    this.allListeners = new Set();
  }

  /**
   * Subscribe to a specific event type
   */
  on<T = unknown>(
    type: FlowDesignerEventType,
    handler: FlowDesignerEventHandler<T>
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as FlowDesignerEventHandler);

    // Return unsubscribe function
    return () => {
      this.off(type, handler);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: FlowDesignerEventHandler): () => void {
    this.allListeners.add(handler);
    return () => {
      this.allListeners.delete(handler);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(
    type: FlowDesignerEventType,
    handler: FlowDesignerEventHandler<T>
  ): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler as FlowDesignerEventHandler);
    }
  }

  /**
   * Emit an event
   */
  emit<T = unknown>(type: FlowDesignerEventType, payload?: T): void {
    const event: FlowDesignerEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    // Notify specific listeners
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${type}:`, error);
        }
      });
    }

    // Notify all-event listeners
    this.allListeners.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in all-event handler:`, error);
      }
    });
  }

  /**
   * Subscribe to an event once
   */
  once<T = unknown>(
    type: FlowDesignerEventType,
    handler: FlowDesignerEventHandler<T>
  ): () => void {
    const wrappedHandler: FlowDesignerEventHandler<T> = (event) => {
      this.off(type, wrappedHandler);
      handler(event);
    };
    return this.on(type, wrappedHandler);
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.allListeners.clear();
  }

  /**
   * Clear listeners for a specific event type
   */
  clearType(type: FlowDesignerEventType): void {
    this.listeners.delete(type);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global event emitter instance
 */
export const flowEvents = new FlowEventEmitter();

// ============================================================================
// Event Helper Functions
// ============================================================================

/**
 * Emit node added event
 */
export function emitNodeAdd(nodeId: string, parentId: string, nodeType: string): void {
  flowEvents.emit('node:add', { nodeId, parentId, nodeType });
}

/**
 * Emit node deleted event
 */
export function emitNodeDelete(nodeId: string): void {
  flowEvents.emit('node:delete', { nodeId });
}

/**
 * Emit node updated event
 */
export function emitNodeUpdate(nodeId: string, changes: Record<string, unknown>): void {
  flowEvents.emit('node:update', { nodeId, changes });
}

/**
 * Emit node selected event
 */
export function emitNodeSelect(nodeId: string | null): void {
  flowEvents.emit('node:select', { nodeId });
}

/**
 * Emit node moved event
 */
export function emitNodeMove(
  nodeId: string,
  fromParentId: string,
  toParentId: string,
  newIndex: number
): void {
  flowEvents.emit('node:move', { nodeId, fromParentId, toParentId, newIndex });
}

/**
 * Emit schema changed event
 */
export function emitSchemaChange(): void {
  flowEvents.emit('schema:change', {});
}

/**
 * Emit schema saved event
 */
export function emitSchemaSave(): void {
  flowEvents.emit('schema:save', {});
}

/**
 * Emit undo event
 */
export function emitUndo(): void {
  flowEvents.emit('history:undo', {});
}

/**
 * Emit redo event
 */
export function emitRedo(): void {
  flowEvents.emit('history:redo', {});
}

// ============================================================================
// React Hook
// ============================================================================

import { useEffect, useCallback } from 'react';

/**
 * Hook to subscribe to flow designer events
 */
export function useFlowEvent<T = unknown>(
  type: FlowDesignerEventType,
  handler: FlowDesignerEventHandler<T>,
  deps: React.DependencyList = []
): void {
  const memoizedHandler = useCallback(handler, deps);

  useEffect(() => {
    return flowEvents.on(type, memoizedHandler);
  }, [type, memoizedHandler]);
}

/**
 * Hook to subscribe to all flow designer events
 */
export function useAllFlowEvents(
  handler: FlowDesignerEventHandler,
  deps: React.DependencyList = []
): void {
  const memoizedHandler = useCallback(handler, deps);

  useEffect(() => {
    return flowEvents.onAll(memoizedHandler);
  }, [memoizedHandler]);
}

export default flowEvents;
