/**
 * Trigger Manager
 * Manages flow triggers and schedules
 * @module flow-runtime/triggers/TriggerManager
 */

import { ulid } from 'ulid';
import type { FlowSchema, FlowTriggerType } from '@workspace/flow-designer';
import type {
  TriggerData,
  TriggerPayload,
  ManualTriggerPayload,
  ScheduleTriggerPayload,
  WebhookTriggerPayload,
  RecordTriggerPayload,
  FormTriggerPayload,
  TriggerHandler,
} from '../types/index.js';
import { ExecutionEngine } from '../engine/ExecutionEngine.js';

// ============================================================================
// Types
// ============================================================================

interface RegisteredFlow {
  flowId: string;
  flowSchema: FlowSchema;
  config: Record<string, unknown>;
}

interface ScheduleEntry {
  flowId: string;
  cron?: string;
  interval?: number;
  nextRun: Date;
  timerId?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Trigger Handlers
// ============================================================================

/**
 * Manual trigger handler
 */
class ManualTriggerHandler implements TriggerHandler {
  type: 'manual' = 'manual';
  private flows: Map<string, RegisteredFlow> = new Map();

  async register(flowId: string, config: Record<string, unknown>): Promise<void> {
    this.flows.set(flowId, { flowId, flowSchema: {} as FlowSchema, config });
  }

  async unregister(flowId: string): Promise<void> {
    this.flows.delete(flowId);
  }

  isRegistered(flowId: string): boolean {
    return this.flows.has(flowId);
  }
}

/**
 * Schedule trigger handler
 */
class ScheduleTriggerHandler implements TriggerHandler {
  type: 'schedule' = 'schedule';
  private schedules: Map<string, ScheduleEntry> = new Map();
  private running: boolean = false;
  private onTrigger?: (flowId: string, payload: ScheduleTriggerPayload) => Promise<void>;

  async init(): Promise<void> {
    this.running = true;
  }

  async cleanup(): Promise<void> {
    this.running = false;
    for (const entry of this.schedules.values()) {
      if (entry.timerId) {
        clearTimeout(entry.timerId);
      }
    }
    this.schedules.clear();
  }

  async register(flowId: string, config: Record<string, unknown>): Promise<void> {
    const { cron, interval, timezone } = config as { cron?: string; interval?: number; timezone?: string };
    
    const entry: ScheduleEntry = {
      flowId,
      cron,
      interval,
      nextRun: this.calculateNextRun(cron, interval),
    };

    this.schedules.set(flowId, entry);
    this.scheduleNext(flowId);
  }

  async unregister(flowId: string): Promise<void> {
    const entry = this.schedules.get(flowId);
    if (entry?.timerId) {
      clearTimeout(entry.timerId);
    }
    this.schedules.delete(flowId);
  }

  setTriggerCallback(callback: (flowId: string, payload: ScheduleTriggerPayload) => Promise<void>): void {
    this.onTrigger = callback;
  }

  private calculateNextRun(cron?: string, interval?: number): Date {
    if (interval) {
      return new Date(Date.now() + interval);
    }
    
    if (cron) {
      // Simple cron parsing - in production use cron-parser
      // For now, default to 1 minute from now
      return new Date(Date.now() + 60000);
    }
    
    return new Date(Date.now() + 60000);
  }

  private scheduleNext(flowId: string): void {
    if (!this.running) return;
    
    const entry = this.schedules.get(flowId);
    if (!entry) return;

    const delay = Math.max(0, entry.nextRun.getTime() - Date.now());
    
    entry.timerId = setTimeout(async () => {
      if (!this.running) return;
      
      const payload: ScheduleTriggerPayload = {
        type: 'schedule',
        scheduledTime: new Date(),
        cron: entry.cron,
        interval: entry.interval,
      };

      if (this.onTrigger) {
        await this.onTrigger(flowId, payload);
      }

      // Schedule next run
      entry.nextRun = this.calculateNextRun(entry.cron, entry.interval);
      this.scheduleNext(flowId);
    }, delay);
  }
}

/**
 * Webhook trigger handler
 */
class WebhookTriggerHandler implements TriggerHandler {
  type: 'webhook' = 'webhook';
  private webhooks: Map<string, { flowId: string; path: string; method: string }> = new Map();
  private pathToFlow: Map<string, string> = new Map();

  async register(flowId: string, config: Record<string, unknown>): Promise<void> {
    const { path, method = 'POST' } = config as { path: string; method?: string };
    
    this.webhooks.set(flowId, { flowId, path, method });
    this.pathToFlow.set(`${method}:${path}`, flowId);
  }

  async unregister(flowId: string): Promise<void> {
    const webhook = this.webhooks.get(flowId);
    if (webhook) {
      this.pathToFlow.delete(`${webhook.method}:${webhook.path}`);
    }
    this.webhooks.delete(flowId);
  }

  /**
   * Find flow ID for a webhook request
   */
  findFlowForRequest(method: string, path: string): string | undefined {
    return this.pathToFlow.get(`${method}:${path}`);
  }

  /**
   * Get all registered webhook paths
   */
  getWebhookPaths(): Array<{ flowId: string; path: string; method: string }> {
    return Array.from(this.webhooks.values());
  }
}

/**
 * Record trigger handler
 */
class RecordTriggerHandler implements TriggerHandler {
  type: 'record' = 'record';
  private subscriptions: Map<string, { flowId: string; tableId: string; events: string[] }> = new Map();
  private tableSubscriptions: Map<string, Set<string>> = new Map();

  async register(flowId: string, config: Record<string, unknown>): Promise<void> {
    const { tableId, events = ['create', 'update', 'delete'] } = config as { 
      tableId: string; 
      events?: string[];
    };
    
    this.subscriptions.set(flowId, { flowId, tableId, events });
    
    if (!this.tableSubscriptions.has(tableId)) {
      this.tableSubscriptions.set(tableId, new Set());
    }
    this.tableSubscriptions.get(tableId)!.add(flowId);
  }

  async unregister(flowId: string): Promise<void> {
    const sub = this.subscriptions.get(flowId);
    if (sub) {
      this.tableSubscriptions.get(sub.tableId)?.delete(flowId);
    }
    this.subscriptions.delete(flowId);
  }

  /**
   * Get flow IDs subscribed to a table event
   */
  getSubscribedFlows(tableId: string, event: string): string[] {
    const flowIds = this.tableSubscriptions.get(tableId);
    if (!flowIds) return [];
    
    return Array.from(flowIds).filter(flowId => {
      const sub = this.subscriptions.get(flowId);
      return sub && sub.events.includes(event);
    });
  }
}

/**
 * Form trigger handler
 */
class FormTriggerHandler implements TriggerHandler {
  type: 'form' = 'form';
  private forms: Map<string, { flowId: string; formId: string }> = new Map();
  private formToFlow: Map<string, string> = new Map();

  async register(flowId: string, config: Record<string, unknown>): Promise<void> {
    const { formId } = config as { formId: string };
    
    this.forms.set(flowId, { flowId, formId });
    this.formToFlow.set(formId, flowId);
  }

  async unregister(flowId: string): Promise<void> {
    const form = this.forms.get(flowId);
    if (form) {
      this.formToFlow.delete(form.formId);
    }
    this.forms.delete(flowId);
  }

  /**
   * Get flow ID for a form submission
   */
  getFlowForForm(formId: string): string | undefined {
    return this.formToFlow.get(formId);
  }
}

// ============================================================================
// Trigger Manager
// ============================================================================

/**
 * Trigger manager - coordinates all trigger handlers
 */
export class TriggerManager {
  private engine: ExecutionEngine;
  private flows: Map<string, FlowSchema>;
  private handlers: Map<FlowTriggerType, TriggerHandler>;

  // Typed handlers for direct access
  readonly manual: ManualTriggerHandler;
  readonly schedule: ScheduleTriggerHandler;
  readonly webhook: WebhookTriggerHandler;
  readonly record: RecordTriggerHandler;
  readonly form: FormTriggerHandler;

  constructor(engine: ExecutionEngine) {
    this.engine = engine;
    this.flows = new Map();
    this.handlers = new Map();

    // Initialize handlers
    this.manual = new ManualTriggerHandler();
    this.schedule = new ScheduleTriggerHandler();
    this.webhook = new WebhookTriggerHandler();
    this.record = new RecordTriggerHandler();
    this.form = new FormTriggerHandler();

    // Register handlers
    this.handlers.set('manual', this.manual);
    this.handlers.set('schedule', this.schedule);
    this.handlers.set('webhook', this.webhook);
    this.handlers.set('record', this.record);
    this.handlers.set('form', this.form);

    // Set up schedule callback
    this.schedule.setTriggerCallback(async (flowId, payload) => {
      await this.triggerFlow(flowId, {
        type: 'schedule',
        source: 'schedule',
        timestamp: new Date(),
        payload,
      });
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Initialize all handlers
   */
  async init(): Promise<void> {
    for (const handler of this.handlers.values()) {
      if (handler.init) {
        await handler.init();
      }
    }
  }

  /**
   * Cleanup all handlers
   */
  async cleanup(): Promise<void> {
    for (const handler of this.handlers.values()) {
      if (handler.cleanup) {
        await handler.cleanup();
      }
    }
    this.flows.clear();
  }

  // ==========================================================================
  // Flow Registration
  // ==========================================================================

  /**
   * Register a flow for triggering
   */
  async registerFlow(flowSchema: FlowSchema): Promise<void> {
    const { id, triggerType, triggerNodeId, nodes } = flowSchema;
    
    // Store flow schema
    this.flows.set(id, flowSchema);

    // Find trigger node config
    const triggerNode = triggerNodeId 
      ? nodes.find(n => n.id === triggerNodeId)
      : nodes.find(n => n.category === 'trigger');

    if (!triggerNode) {
      console.warn(`No trigger node found for flow ${id}`);
      return;
    }

    // Register with appropriate handler
    const handler = this.handlers.get(triggerType);
    if (handler) {
      await handler.register(id, triggerNode.config);
    }
  }

  /**
   * Unregister a flow
   */
  async unregisterFlow(flowId: string): Promise<void> {
    const schema = this.flows.get(flowId);
    if (!schema) return;

    const handler = this.handlers.get(schema.triggerType);
    if (handler) {
      await handler.unregister(flowId);
    }

    this.flows.delete(flowId);
  }

  /**
   * Update a flow registration
   */
  async updateFlow(flowSchema: FlowSchema): Promise<void> {
    await this.unregisterFlow(flowSchema.id);
    await this.registerFlow(flowSchema);
  }

  // ==========================================================================
  // Trigger Methods
  // ==========================================================================

  /**
   * Trigger a flow manually
   */
  async triggerManual(
    flowId: string,
    inputs: Record<string, unknown> = {},
    userId?: string
  ): Promise<string> {
    const payload: ManualTriggerPayload = {
      type: 'manual',
      userId,
      inputs,
    };

    return this.triggerFlow(flowId, {
      type: 'manual',
      source: userId || 'anonymous',
      timestamp: new Date(),
      payload,
    });
  }

  /**
   * Handle webhook request
   */
  async handleWebhook(
    method: string,
    path: string,
    headers: Record<string, string>,
    query: Record<string, string>,
    body: unknown,
    ip?: string
  ): Promise<string | null> {
    const flowId = this.webhook.findFlowForRequest(method, path);
    if (!flowId) return null;

    const payload: WebhookTriggerPayload = {
      type: 'webhook',
      method,
      path,
      headers,
      query,
      body,
      ip,
    };

    return this.triggerFlow(flowId, {
      type: 'webhook',
      source: path,
      timestamp: new Date(),
      payload,
    });
  }

  /**
   * Handle record event
   */
  async handleRecordEvent(
    event: 'create' | 'update' | 'delete',
    tableId: string,
    recordId: string,
    record: Record<string, unknown>,
    previousRecord?: Record<string, unknown>
  ): Promise<string[]> {
    const flowIds = this.record.getSubscribedFlows(tableId, event);
    const runIds: string[] = [];

    for (const flowId of flowIds) {
      const changes = previousRecord ? this.computeChanges(previousRecord, record) : undefined;
      
      const payload: RecordTriggerPayload = {
        type: 'record',
        event,
        tableId,
        recordId,
        record,
        previousRecord,
        changes,
      };

      const runId = await this.triggerFlow(flowId, {
        type: 'record',
        source: tableId,
        timestamp: new Date(),
        payload,
      });

      runIds.push(runId);
    }

    return runIds;
  }

  /**
   * Handle form submission
   */
  async handleFormSubmission(
    formId: string,
    data: Record<string, unknown>,
    submittedBy?: string
  ): Promise<string | null> {
    const flowId = this.form.getFlowForForm(formId);
    if (!flowId) return null;

    const payload: FormTriggerPayload = {
      type: 'form',
      formId,
      submissionId: ulid(),
      data,
      submittedBy,
    };

    return this.triggerFlow(flowId, {
      type: 'form',
      source: formId,
      timestamp: new Date(),
      payload,
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Trigger a flow with given data
   */
  private async triggerFlow(flowId: string, triggerData: TriggerData): Promise<string> {
    const schema = this.flows.get(flowId);
    if (!schema) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    const run = await this.engine.execute(
      schema,
      triggerData,
      triggerData.payload.type === 'manual' ? (triggerData.payload as ManualTriggerPayload).inputs || {} : {}
    );

    return run.id;
  }

  /**
   * Compute changes between two records
   */
  private computeChanges(
    prev: Record<string, unknown>,
    curr: Record<string, unknown>
  ): Record<string, { old: unknown; new: unknown }> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

    for (const key of allKeys) {
      if (prev[key] !== curr[key]) {
        changes[key] = { old: prev[key], new: curr[key] };
      }
    }

    return changes;
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get all registered flows
   */
  getRegisteredFlows(): FlowSchema[] {
    return Array.from(this.flows.values());
  }

  /**
   * Get flows by trigger type
   */
  getFlowsByTriggerType(type: FlowTriggerType): FlowSchema[] {
    return Array.from(this.flows.values()).filter(f => f.triggerType === type);
  }

  /**
   * Check if flow is registered
   */
  isFlowRegistered(flowId: string): boolean {
    return this.flows.has(flowId);
  }

  /**
   * Get webhook endpoints
   */
  getWebhookEndpoints(): Array<{ flowId: string; path: string; method: string }> {
    return this.webhook.getWebhookPaths();
  }
}

export default TriggerManager;
