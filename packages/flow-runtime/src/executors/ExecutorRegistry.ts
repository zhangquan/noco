/**
 * Executor Registry
 * Registry for node executors
 * @module flow-runtime/executors/ExecutorRegistry
 */

import type { NodeType } from '@workspace/flow-designer';
import type { NodeExecutorDef, NodeExecutor } from '../types/index.js';

// ============================================================================
// Built-in Executors
// ============================================================================

/**
 * Manual trigger executor - does nothing, outputs are set externally
 */
const manualTriggerExecutor: NodeExecutor = async (context, config) => {
  context.log('info', 'Manual trigger executed');
  // Outputs are set by the engine from trigger data
};

/**
 * Schedule trigger executor
 */
const scheduleTriggerExecutor: NodeExecutor = async (context, config) => {
  context.log('info', 'Schedule trigger executed');
  // Outputs are set by the engine from trigger data
};

/**
 * Webhook trigger executor
 */
const webhookTriggerExecutor: NodeExecutor = async (context, config) => {
  context.log('info', 'Webhook trigger executed');
  // Outputs are set by the engine from trigger data
};

/**
 * Record trigger executor
 */
const recordTriggerExecutor: NodeExecutor = async (context, config) => {
  context.log('info', 'Record trigger executed');
  // Outputs are set by the engine from trigger data
};

/**
 * Form trigger executor
 */
const formTriggerExecutor: NodeExecutor = async (context, config) => {
  context.log('info', 'Form trigger executed');
  // Outputs are set by the engine from trigger data
};

/**
 * Condition node executor
 */
const conditionExecutor: NodeExecutor = async (context, config) => {
  const condition = config.condition as string;
  const data = context.getInput('Input');
  
  context.log('debug', 'Evaluating condition', { condition, data });
  
  // Simple condition evaluation (in production, use a proper expression parser)
  let result = false;
  try {
    // Create a function to evaluate the condition
    const evalFn = new Function('data', 'context', `return ${condition}`);
    result = Boolean(evalFn(data, context));
  } catch (error) {
    context.log('error', 'Condition evaluation failed', { error });
    result = false;
  }

  if (result) {
    context.setOutput('True', data);
  } else {
    context.setOutput('False', data);
  }
  
  context.log('info', `Condition evaluated to: ${result}`);
};

/**
 * Switch node executor
 */
const switchExecutor: NodeExecutor = async (context, config) => {
  const value = context.getInput('Value');
  const cases = (config.cases as Array<{ value: unknown; output: string }>) || [];
  
  context.log('debug', 'Switch evaluating', { value, cases });
  
  let matched = false;
  for (const caseItem of cases) {
    if (value === caseItem.value) {
      context.setOutput(caseItem.output, context.getInput('Input'));
      matched = true;
      break;
    }
  }
  
  if (!matched && config.defaultCase) {
    context.setOutput('Default', context.getInput('Input'));
  }
};

/**
 * Loop node executor
 */
const loopExecutor: NodeExecutor = async (context, config) => {
  const mode = (config.mode as string) || 'items';
  let items: unknown[];
  
  if (mode === 'items') {
    const input = context.getInput('Items');
    items = Array.isArray(input) ? input : [input];
  } else {
    const count = (config.count as number) || 10;
    items = Array.from({ length: count }, (_, i) => i);
  }
  
  context.log('info', `Loop executing ${items.length} iterations`);
  
  const results: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    if (context.isCancelled()) break;
    
    context.setOutput('Item', items[i]);
    context.setOutput('Index', i);
    context.setOutput('Each', true);
    
    // In a real implementation, this would trigger child nodes
    results.push(items[i]);
  }
  
  context.setOutput('Done', results);
};

/**
 * HTTP request executor
 */
const httpRequestExecutor: NodeExecutor = async (context, config) => {
  const method = (config.method as string) || 'GET';
  const url = (config.url as string) || context.getInput('URL') as string;
  const headers = (config.headers as Record<string, string>) || {};
  const body = config.body ?? context.getInput('Body');
  const timeout = (config.timeout as number) || 30000;
  
  if (!url) {
    throw new Error('URL is required for HTTP request');
  }
  
  context.log('info', `HTTP ${method} ${url}`);
  
  try {
    const response = await context.http.request({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url,
      headers,
      body,
      timeout,
    });
    
    context.setOutput('Response', response);
    context.setOutput('Body', response.body);
    context.setOutput('Status', response.status);
    
    if (response.ok) {
      context.setOutput('Success', true);
    } else {
      context.setOutput('Error', { status: response.status, body: response.body });
    }
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'HTTP request failed', { error });
    throw error;
  }
};

/**
 * Query data executor
 */
const queryExecutor: NodeExecutor = async (context, config) => {
  const tableId = config.tableId as string;
  const filters = (config.filters as unknown[]) || [];
  const sorts = (config.sorts as unknown[]) || [];
  const limit = (config.limit as number) || 100;
  const offset = (config.offset as number) || 0;
  
  context.log('info', `Querying table: ${tableId}`);
  
  try {
    const result = await context.project.query(tableId, {
      filters: filters as [],
      sorts: sorts as [],
      limit,
      offset,
    });
    
    context.setOutput('Records', result.records);
    context.setOutput('Count', result.total);
    context.setOutput('Success', true);
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'Query failed', { error });
    throw error;
  }
};

/**
 * Create record executor
 */
const createRecordExecutor: NodeExecutor = async (context, config) => {
  const tableId = config.tableId as string;
  const data = (config.data as Record<string, unknown>) || context.getInput('Data') as Record<string, unknown>;
  
  context.log('info', `Creating record in table: ${tableId}`);
  
  try {
    const record = await context.project.create(tableId, data);
    context.setOutput('Record', record);
    context.setOutput('Success', true);
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'Create failed', { error });
    throw error;
  }
};

/**
 * Update record executor
 */
const updateRecordExecutor: NodeExecutor = async (context, config) => {
  const tableId = config.tableId as string;
  const recordId = (config.recordId as string) || context.getInput('RecordId') as string;
  const data = (config.data as Record<string, unknown>) || context.getInput('Data') as Record<string, unknown>;
  
  context.log('info', `Updating record ${recordId} in table: ${tableId}`);
  
  try {
    const record = await context.project.update(tableId, recordId, data);
    context.setOutput('Record', record);
    context.setOutput('Success', true);
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'Update failed', { error });
    throw error;
  }
};

/**
 * Delete record executor
 */
const deleteRecordExecutor: NodeExecutor = async (context, config) => {
  const tableId = config.tableId as string;
  const recordId = (config.recordId as string) || context.getInput('RecordId') as string;
  
  context.log('info', `Deleting record ${recordId} from table: ${tableId}`);
  
  try {
    await context.project.delete(tableId, recordId);
    context.setOutput('Success', true);
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'Delete failed', { error });
    throw error;
  }
};

/**
 * Script executor
 */
const scriptExecutor: NodeExecutor = async (context, config) => {
  const code = config.code as string;
  const timeout = (config.timeout as number) || 10000;
  const data = context.getInput('Data');
  
  context.log('info', 'Executing script');
  
  try {
    // Create a sandboxed function (in production, use a proper sandbox)
    const fn = new Function('data', 'context', 'log', `
      return (async () => {
        ${code}
      })();
    `);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Script timeout')), timeout);
    });
    
    const result = await Promise.race([
      fn(data, { getVariable: context.getVariable, setVariable: context.setVariable }, context.log),
      timeoutPromise,
    ]);
    
    context.setOutput('Result', result);
    context.setOutput('Success', true);
  } catch (error) {
    context.setOutput('Error', error);
    context.log('error', 'Script execution failed', { error });
    throw error;
  }
};

/**
 * Email executor (placeholder)
 */
const emailExecutor: NodeExecutor = async (context, config) => {
  const to = config.to as string;
  const subject = config.subject as string;
  const body = config.body as string;
  
  context.log('info', `Sending email to: ${to}`);
  
  // In production, integrate with email service
  context.log('warn', 'Email sending is not implemented');
  context.setOutput('Success', true);
};

/**
 * Delay executor
 */
const delayExecutor: NodeExecutor = async (context, config) => {
  const delay = config.delay as number;
  const unit = (config.unit as string) || 'ms';
  
  let ms = delay;
  switch (unit) {
    case 's': ms = delay * 1000; break;
    case 'm': ms = delay * 60 * 1000; break;
    case 'h': ms = delay * 60 * 60 * 1000; break;
  }
  
  context.log('info', `Delaying for ${ms}ms`);
  await context.sleep(ms);
  context.setOutput('Output', context.getInput('Input'));
};

/**
 * Log executor
 */
const logExecutor: NodeExecutor = async (context, config) => {
  const level = (config.level as 'debug' | 'info' | 'warn' | 'error') || 'info';
  const message = (config.message as string) || context.getInput('Message');
  
  context.log(level, String(message));
  context.setOutput('Output', context.getInput('Input'));
};

// ============================================================================
// Built-in Executor Definitions
// ============================================================================

const BUILTIN_EXECUTORS: NodeExecutorDef[] = [
  // Triggers
  { type: 'trigger:manual', execute: manualTriggerExecutor },
  { type: 'trigger:schedule', execute: scheduleTriggerExecutor },
  { type: 'trigger:webhook', execute: webhookTriggerExecutor },
  { type: 'trigger:record', execute: recordTriggerExecutor },
  { type: 'trigger:form', execute: formTriggerExecutor },
  // Logic
  { type: 'logic:condition', execute: conditionExecutor },
  { type: 'logic:switch', execute: switchExecutor },
  { type: 'logic:loop', execute: loopExecutor },
  // Actions
  { type: 'action:http', execute: httpRequestExecutor },
  { type: 'action:query', execute: queryExecutor },
  { type: 'action:create', execute: createRecordExecutor },
  { type: 'action:update', execute: updateRecordExecutor },
  { type: 'action:delete', execute: deleteRecordExecutor },
  { type: 'action:script', execute: scriptExecutor },
  // Integrations
  { type: 'integration:email', execute: emailExecutor },
  // Utilities
  { type: 'utility:delay', execute: delayExecutor },
  { type: 'utility:log', execute: logExecutor },
];

// ============================================================================
// Executor Registry
// ============================================================================

/**
 * Executor registry - manages node executors
 */
export class ExecutorRegistry {
  private executors: Map<NodeType, NodeExecutorDef>;

  constructor() {
    this.executors = new Map();
    this.registerBuiltins();
  }

  /**
   * Register built-in executors
   */
  private registerBuiltins(): void {
    for (const def of BUILTIN_EXECUTORS) {
      this.executors.set(def.type, def);
    }
  }

  /**
   * Register a custom executor
   */
  register(def: NodeExecutorDef): void {
    this.executors.set(def.type, def);
  }

  /**
   * Unregister an executor
   */
  unregister(type: NodeType): boolean {
    return this.executors.delete(type);
  }

  /**
   * Get an executor by type
   */
  get(type: NodeType): NodeExecutorDef | undefined {
    return this.executors.get(type);
  }

  /**
   * Check if executor exists
   */
  has(type: NodeType): boolean {
    return this.executors.has(type);
  }

  /**
   * Get all registered types
   */
  getTypes(): NodeType[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Initialize all executors
   */
  async initAll(): Promise<void> {
    for (const def of this.executors.values()) {
      if (def.init) {
        await def.init();
      }
    }
  }

  /**
   * Cleanup all executors
   */
  async cleanupAll(): Promise<void> {
    for (const def of this.executors.values()) {
      if (def.cleanup) {
        await def.cleanup();
      }
    }
  }
}

// Export built-in executors for direct access
export {
  manualTriggerExecutor,
  scheduleTriggerExecutor,
  webhookTriggerExecutor,
  recordTriggerExecutor,
  formTriggerExecutor,
  conditionExecutor,
  switchExecutor,
  loopExecutor,
  httpRequestExecutor,
  queryExecutor,
  createRecordExecutor,
  updateRecordExecutor,
  deleteRecordExecutor,
  scriptExecutor,
  emailExecutor,
  delayExecutor,
  logExecutor,
  BUILTIN_EXECUTORS,
};
