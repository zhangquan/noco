/**
 * Custom Event System
 * 
 * Event emitter for flow designer events.
 */

export type EventHandler<T = unknown> = (data: T) => void;

export interface FlowEvents {
  'node:select': { nodeId: string | null };
  'node:add': { nodeId: string; parentId: string };
  'node:remove': { nodeId: string };
  'node:update': { nodeId: string; changes: Record<string, unknown> };
  'node:move': { nodeId: string; newParentId: string; newIndex: number };
  'schema:change': { schema: unknown };
  'schema:save': { schema: unknown };
  'schema:publish': { schema: unknown };
  'history:undo': { schema: unknown };
  'history:redo': { schema: unknown };
  'designer:ready': Record<string, never>;
  'designer:zoom': { zoom: number };
  'designer:pan': { x: number; y: number };
}

/**
 * Event emitter class
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  private handlers: Map<keyof Events, Set<EventHandler<unknown>>> = new Map();

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
    }
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrappedHandler: EventHandler<Events[K]> = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * Emit an event
   */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    }
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get handler count for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers.get(event)?.size || 0;
  }
}

// Export singleton for flow events
export const flowEvents = new EventEmitter<FlowEvents>();

// Export class for custom instances
export { EventEmitter as FlowEventEmitter };
