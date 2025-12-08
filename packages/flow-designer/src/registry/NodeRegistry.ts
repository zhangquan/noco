/**
 * Node Registry
 * Registry for built-in and custom node definitions
 * @module flow-designer/registry/NodeRegistry
 */

import type {
  NodeDefinition,
  NodeType,
  NodeCategory,
} from '../types/index.js';

// ============================================================================
// Built-in Node Definitions
// ============================================================================

/**
 * Manual trigger node definition
 */
const ManualTriggerDef: NodeDefinition = {
  type: 'trigger:manual',
  category: 'trigger',
  name: 'Manual Trigger',
  description: 'Manually triggered workflow entry point',
  icon: 'play',
  defaultLabel: 'Manual Trigger',
  inputs: [],
  outputs: [
    { label: 'Output', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {},
  singleton: true,
  version: '1.0.0',
};

/**
 * Schedule trigger node definition
 */
const ScheduleTriggerDef: NodeDefinition = {
  type: 'trigger:schedule',
  category: 'trigger',
  name: 'Schedule',
  description: 'Trigger workflow on a schedule',
  icon: 'clock',
  defaultLabel: 'Schedule',
  inputs: [],
  outputs: [
    { label: 'Output', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    cron: '',
    timezone: 'UTC',
  },
  configSchema: {
    type: 'object',
    properties: {
      cron: { type: 'string', description: 'Cron expression' },
      interval: { type: 'number', description: 'Interval in milliseconds' },
      timezone: { type: 'string', description: 'Timezone' },
    },
  },
  singleton: true,
  version: '1.0.0',
};

/**
 * Webhook trigger node definition
 */
const WebhookTriggerDef: NodeDefinition = {
  type: 'trigger:webhook',
  category: 'trigger',
  name: 'Webhook',
  description: 'Trigger workflow via webhook',
  icon: 'webhook',
  defaultLabel: 'Webhook',
  inputs: [],
  outputs: [
    { label: 'Request', direction: 'output', dataType: 'object' },
    { label: 'Headers', direction: 'output', dataType: 'object' },
    { label: 'Body', direction: 'output', dataType: 'any' },
  ],
  defaultConfig: {
    method: 'POST',
    path: '',
    authentication: 'none',
  },
  singleton: true,
  version: '1.0.0',
};

/**
 * Record trigger node definition
 */
const RecordTriggerDef: NodeDefinition = {
  type: 'trigger:record',
  category: 'trigger',
  name: 'Record Event',
  description: 'Trigger on record create/update/delete',
  icon: 'database',
  defaultLabel: 'Record Event',
  inputs: [],
  outputs: [
    { label: 'Record', direction: 'output', dataType: 'object' },
    { label: 'Previous', direction: 'output', dataType: 'object' },
    { label: 'Event', direction: 'output', dataType: 'string' },
  ],
  defaultConfig: {
    tableId: '',
    events: ['create', 'update', 'delete'],
  },
  singleton: true,
  version: '1.0.0',
};

/**
 * Form trigger node definition
 */
const FormTriggerDef: NodeDefinition = {
  type: 'trigger:form',
  category: 'trigger',
  name: 'Form Submit',
  description: 'Trigger on form submission',
  icon: 'form',
  defaultLabel: 'Form Submit',
  inputs: [],
  outputs: [
    { label: 'Data', direction: 'output', dataType: 'object' },
    { label: 'FormId', direction: 'output', dataType: 'string' },
  ],
  defaultConfig: {
    formId: '',
  },
  singleton: true,
  version: '1.0.0',
};

/**
 * Condition node definition
 */
const ConditionDef: NodeDefinition = {
  type: 'logic:condition',
  category: 'logic',
  name: 'Condition',
  description: 'Branch based on a condition',
  icon: 'split',
  defaultLabel: 'Condition',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
  ],
  outputs: [
    { label: 'True', direction: 'output', dataType: 'flow' },
    { label: 'False', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    condition: '',
  },
  version: '1.0.0',
};

/**
 * Switch node definition
 */
const SwitchDef: NodeDefinition = {
  type: 'logic:switch',
  category: 'logic',
  name: 'Switch',
  description: 'Branch to multiple paths based on value',
  icon: 'switch',
  defaultLabel: 'Switch',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'Value', direction: 'input', dataType: 'any' },
  ],
  outputs: [
    { label: 'Default', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    cases: [],
    defaultCase: true,
  },
  version: '1.0.0',
};

/**
 * Loop node definition
 */
const LoopDef: NodeDefinition = {
  type: 'logic:loop',
  category: 'logic',
  name: 'Loop',
  description: 'Iterate over items or repeat a number of times',
  icon: 'loop',
  defaultLabel: 'Loop',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'Items', direction: 'input', dataType: 'array' },
  ],
  outputs: [
    { label: 'Each', direction: 'output', dataType: 'flow' },
    { label: 'Item', direction: 'output', dataType: 'any' },
    { label: 'Index', direction: 'output', dataType: 'number' },
    { label: 'Done', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    mode: 'items', // 'items' | 'count'
    count: 10,
    parallel: false,
  },
  version: '1.0.0',
};

/**
 * HTTP Request node definition
 */
const HttpRequestDef: NodeDefinition = {
  type: 'action:http',
  category: 'action',
  name: 'HTTP Request',
  description: 'Make an HTTP request',
  icon: 'globe',
  defaultLabel: 'HTTP Request',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'URL', direction: 'input', dataType: 'string' },
    { label: 'Body', direction: 'input', dataType: 'any' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
    { label: 'Response', direction: 'output', dataType: 'object' },
    { label: 'Body', direction: 'output', dataType: 'any' },
    { label: 'Status', direction: 'output', dataType: 'number' },
  ],
  defaultConfig: {
    method: 'GET',
    url: '',
    headers: {},
    body: null,
    timeout: 30000,
    retries: 0,
  },
  version: '1.0.0',
};

/**
 * Query data node definition
 */
const QueryDef: NodeDefinition = {
  type: 'action:query',
  category: 'action',
  name: 'Query Data',
  description: 'Query records from a table',
  icon: 'search',
  defaultLabel: 'Query',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
    { label: 'Records', direction: 'output', dataType: 'array' },
    { label: 'Count', direction: 'output', dataType: 'number' },
  ],
  defaultConfig: {
    tableId: '',
    filters: [],
    sorts: [],
    limit: 100,
    offset: 0,
  },
  version: '1.0.0',
};

/**
 * Create record node definition
 */
const CreateRecordDef: NodeDefinition = {
  type: 'action:create',
  category: 'action',
  name: 'Create Record',
  description: 'Create a new record',
  icon: 'plus',
  defaultLabel: 'Create Record',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'Data', direction: 'input', dataType: 'object' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
    { label: 'Record', direction: 'output', dataType: 'object' },
  ],
  defaultConfig: {
    tableId: '',
    data: {},
  },
  version: '1.0.0',
};

/**
 * Update record node definition
 */
const UpdateRecordDef: NodeDefinition = {
  type: 'action:update',
  category: 'action',
  name: 'Update Record',
  description: 'Update an existing record',
  icon: 'edit',
  defaultLabel: 'Update Record',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'RecordId', direction: 'input', dataType: 'string' },
    { label: 'Data', direction: 'input', dataType: 'object' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
    { label: 'Record', direction: 'output', dataType: 'object' },
  ],
  defaultConfig: {
    tableId: '',
    recordId: '',
    data: {},
  },
  version: '1.0.0',
};

/**
 * Delete record node definition
 */
const DeleteRecordDef: NodeDefinition = {
  type: 'action:delete',
  category: 'action',
  name: 'Delete Record',
  description: 'Delete a record',
  icon: 'trash',
  defaultLabel: 'Delete Record',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'RecordId', direction: 'input', dataType: 'string' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    tableId: '',
    recordId: '',
  },
  version: '1.0.0',
};

/**
 * Script node definition
 */
const ScriptDef: NodeDefinition = {
  type: 'action:script',
  category: 'action',
  name: 'Script',
  description: 'Execute custom JavaScript code',
  icon: 'code',
  defaultLabel: 'Script',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'Data', direction: 'input', dataType: 'any' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
    { label: 'Result', direction: 'output', dataType: 'any' },
  ],
  defaultConfig: {
    code: '// Your code here\nreturn data;',
    timeout: 10000,
  },
  version: '1.0.0',
};

/**
 * Send email node definition
 */
const SendEmailDef: NodeDefinition = {
  type: 'integration:email',
  category: 'integration',
  name: 'Send Email',
  description: 'Send an email',
  icon: 'mail',
  defaultLabel: 'Send Email',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
  ],
  outputs: [
    { label: 'Success', direction: 'output', dataType: 'flow' },
    { label: 'Error', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    to: '',
    subject: '',
    body: '',
    html: false,
  },
  version: '1.0.0',
};

/**
 * Delay node definition
 */
const DelayDef: NodeDefinition = {
  type: 'utility:delay',
  category: 'utility',
  name: 'Delay',
  description: 'Wait for a specified time',
  icon: 'clock',
  defaultLabel: 'Delay',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
  ],
  outputs: [
    { label: 'Output', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    delay: 1000,
    unit: 'ms', // 'ms' | 's' | 'm' | 'h'
  },
  version: '1.0.0',
};

/**
 * Log node definition
 */
const LogDef: NodeDefinition = {
  type: 'utility:log',
  category: 'utility',
  name: 'Log',
  description: 'Log a message or data',
  icon: 'terminal',
  defaultLabel: 'Log',
  inputs: [
    { label: 'Input', direction: 'input', dataType: 'flow' },
    { label: 'Message', direction: 'input', dataType: 'any' },
  ],
  outputs: [
    { label: 'Output', direction: 'output', dataType: 'flow' },
  ],
  defaultConfig: {
    level: 'info',
    message: '',
  },
  version: '1.0.0',
};

// ============================================================================
// Node Registry
// ============================================================================

/**
 * Node registry - manages node definitions
 */
export class NodeRegistry {
  private definitions: Map<NodeType, NodeDefinition>;

  constructor() {
    this.definitions = new Map();
    this.registerBuiltinNodes();
  }

  /**
   * Register built-in node definitions
   */
  private registerBuiltinNodes(): void {
    // Triggers
    this.register(ManualTriggerDef);
    this.register(ScheduleTriggerDef);
    this.register(WebhookTriggerDef);
    this.register(RecordTriggerDef);
    this.register(FormTriggerDef);

    // Logic
    this.register(ConditionDef);
    this.register(SwitchDef);
    this.register(LoopDef);

    // Actions
    this.register(HttpRequestDef);
    this.register(QueryDef);
    this.register(CreateRecordDef);
    this.register(UpdateRecordDef);
    this.register(DeleteRecordDef);
    this.register(ScriptDef);

    // Integrations
    this.register(SendEmailDef);

    // Utilities
    this.register(DelayDef);
    this.register(LogDef);
  }

  /**
   * Register a node definition
   */
  register(definition: NodeDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  /**
   * Unregister a node definition
   */
  unregister(type: NodeType): boolean {
    return this.definitions.delete(type);
  }

  /**
   * Get a node definition by type
   */
  get(type: NodeType): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Check if a node type is registered
   */
  has(type: NodeType): boolean {
    return this.definitions.has(type);
  }

  /**
   * Get all registered node definitions
   */
  getAll(): NodeDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get node definitions by category
   */
  getByCategory(category: NodeCategory): NodeDefinition[] {
    return this.getAll().filter(d => d.category === category);
  }

  /**
   * Get all trigger node definitions
   */
  getTriggers(): NodeDefinition[] {
    return this.getByCategory('trigger');
  }

  /**
   * Get all action node definitions
   */
  getActions(): NodeDefinition[] {
    return this.getByCategory('action');
  }

  /**
   * Get all logic node definitions
   */
  getLogic(): NodeDefinition[] {
    return this.getByCategory('logic');
  }

  /**
   * Get all transform node definitions
   */
  getTransforms(): NodeDefinition[] {
    return this.getByCategory('transform');
  }

  /**
   * Get all integration node definitions
   */
  getIntegrations(): NodeDefinition[] {
    return this.getByCategory('integration');
  }

  /**
   * Get all utility node definitions
   */
  getUtilities(): NodeDefinition[] {
    return this.getByCategory('utility');
  }

  /**
   * Search node definitions
   */
  search(query: string): NodeDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(d =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.description.toLowerCase().includes(lowerQuery) ||
      d.type.toLowerCase().includes(lowerQuery)
    );
  }
}

// Create default registry instance
export const defaultRegistry = new NodeRegistry();

// Export built-in definitions for direct access
export {
  ManualTriggerDef,
  ScheduleTriggerDef,
  WebhookTriggerDef,
  RecordTriggerDef,
  FormTriggerDef,
  ConditionDef,
  SwitchDef,
  LoopDef,
  HttpRequestDef,
  QueryDef,
  CreateRecordDef,
  UpdateRecordDef,
  DeleteRecordDef,
  ScriptDef,
  SendEmailDef,
  DelayDef,
  LogDef,
};
