/**
 * Supported Event Types
 * 
 * Defines the event types that can trigger a flow.
 */

import { FlowEventTypes } from '../types';

export interface EventTypeDefinition {
  /** Event type value */
  type: FlowEventTypes;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon name */
  icon: string;
  /** Whether requires table selection */
  requiresTable: boolean;
  /** Whether supports view selection */
  supportsView: boolean;
  /** Additional configuration fields */
  configFields?: string[];
}

/**
 * All supported event types
 */
export const supportedEventTypes: EventTypeDefinition[] = [
  {
    type: FlowEventTypes.INSERT,
    name: 'On Record Create',
    description: 'Triggered when a new record is created in the table',
    icon: 'plus-circle',
    requiresTable: true,
    supportsView: true,
  },
  {
    type: FlowEventTypes.UPDATE,
    name: 'On Record Update',
    description: 'Triggered when a record is updated in the table',
    icon: 'edit',
    requiresTable: true,
    supportsView: true,
  },
  {
    type: FlowEventTypes.DELETE,
    name: 'On Record Delete',
    description: 'Triggered when a record is deleted from the table',
    icon: 'delete',
    requiresTable: true,
    supportsView: true,
  },
  {
    type: FlowEventTypes.TIMER,
    name: 'Scheduled',
    description: 'Triggered on a schedule (cron expression)',
    icon: 'clock-circle',
    requiresTable: false,
    supportsView: false,
    configFields: ['cron'],
  },
  {
    type: FlowEventTypes.MANUAL,
    name: 'Manual Trigger',
    description: 'Triggered manually by user action',
    icon: 'play-circle',
    requiresTable: false,
    supportsView: false,
  },
  {
    type: FlowEventTypes.WEBHOOK,
    name: 'Webhook',
    description: 'Triggered by an external HTTP request',
    icon: 'api',
    requiresTable: false,
    supportsView: false,
    configFields: ['webhookUrl'],
  },
];

/**
 * Get event type definition by type
 */
export function getEventTypeDefinition(
  type: FlowEventTypes
): EventTypeDefinition | undefined {
  return supportedEventTypes.find((e) => e.type === type);
}

/**
 * Get event types that require a table
 */
export function getTableEventTypes(): EventTypeDefinition[] {
  return supportedEventTypes.filter((e) => e.requiresTable);
}

/**
 * Get event types that don't require a table
 */
export function getNonTableEventTypes(): EventTypeDefinition[] {
  return supportedEventTypes.filter((e) => !e.requiresTable);
}
