/**
 * Flow Validator Utilities
 * Advanced validation for flow schemas
 * @module utils/validator
 */

import { z } from 'zod';
import type {
  FlowSchema,
  FlowValidationResult,
  FlowValidationError,
  FlowValidationWarning,
  NodeData,
  EdgeData,
} from '../types';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Node port schema
 */
const NodePortSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  direction: z.enum(['input', 'output']),
  dataType: z.enum(['any', 'string', 'number', 'boolean', 'object', 'array', 'date', 'file', 'flow']),
  multiple: z.boolean().optional(),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
});

/**
 * Node position schema
 */
const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * Node size schema
 */
const NodeSizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

/**
 * Node data schema
 */
const NodeDataSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  category: z.enum(['trigger', 'action', 'logic', 'transform', 'integration', 'utility']),
  label: z.string().min(1),
  position: NodePositionSchema,
  size: NodeSizeSchema.optional(),
  inputs: z.array(NodePortSchema),
  outputs: z.array(NodePortSchema),
  config: z.record(z.unknown()),
  meta: z.record(z.unknown()).optional(),
  disabled: z.boolean().optional(),
  description: z.string().optional(),
  version: z.number().optional(),
});

/**
 * Edge data schema
 */
const EdgeDataSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourcePort: z.string().min(1),
  targetId: z.string().min(1),
  targetPort: z.string().min(1),
  type: z.enum(['default', 'conditional', 'error', 'loop']),
  label: z.string().optional(),
  condition: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
  disabled: z.boolean().optional(),
});

/**
 * Flow variable schema
 */
const FlowVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['any', 'string', 'number', 'boolean', 'object', 'array', 'date', 'file', 'flow']),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

/**
 * Flow input schema
 */
const FlowInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['any', 'string', 'number', 'boolean', 'object', 'array', 'date', 'file', 'flow']),
  label: z.string().min(1),
  defaultValue: z.unknown().optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
  }).optional(),
});

/**
 * Flow output schema
 */
const FlowOutputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['any', 'string', 'number', 'boolean', 'object', 'array', 'date', 'file', 'flow']),
  label: z.string().min(1),
  description: z.string().optional(),
});

/**
 * Flow settings schema
 */
const FlowSettingsSchema = z.object({
  timeout: z.number().positive().optional(),
  retry: z.object({
    enabled: z.boolean(),
    maxAttempts: z.number().positive(),
    delay: z.number().positive(),
    backoffMultiplier: z.number().positive().optional(),
  }).optional(),
  errorHandling: z.object({
    continueOnError: z.boolean(),
    errorNodeId: z.string().optional(),
  }).optional(),
  logging: z.object({
    enabled: z.boolean(),
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }).optional(),
}).passthrough();

/**
 * Complete flow schema
 */
export const FlowSchemaValidator = z.object({
  version: z.string(),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(['manual', 'schedule', 'webhook', 'record', 'form']),
  triggerNodeId: z.string().optional(),
  nodes: z.array(NodeDataSchema),
  edges: z.array(EdgeDataSchema),
  variables: z.array(FlowVariableSchema).optional(),
  inputs: z.array(FlowInputSchema).optional(),
  outputs: z.array(FlowOutputSchema).optional(),
  settings: FlowSettingsSchema.optional(),
  meta: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a flow schema using Zod
 */
export function validateFlowSchema(schema: unknown): z.SafeParseReturnType<unknown, unknown> {
  return FlowSchemaValidator.safeParse(schema);
}

/**
 * Comprehensive flow validation
 */
export function validateFlow(schema: FlowSchema): FlowValidationResult {
  const errors: FlowValidationError[] = [];
  const warnings: FlowValidationWarning[] = [];

  // Basic schema validation
  const zodResult = FlowSchemaValidator.safeParse(schema);
  if (!zodResult.success) {
    for (const issue of zodResult.error.issues) {
      errors.push({
        type: 'flow',
        field: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VALIDATION_ERROR',
      });
    }
  }

  // Build node index
  const nodeIndex = new Map<string, NodeData>();
  for (const node of schema.nodes) {
    if (nodeIndex.has(node.id)) {
      errors.push({
        type: 'node',
        targetId: node.id,
        message: `Duplicate node ID: ${node.id}`,
        code: 'DUPLICATE_NODE_ID',
      });
    }
    nodeIndex.set(node.id, node);
  }

  // Build edge index
  const edgeIndex = new Map<string, EdgeData>();
  for (const edge of schema.edges) {
    if (edgeIndex.has(edge.id)) {
      errors.push({
        type: 'edge',
        targetId: edge.id,
        message: `Duplicate edge ID: ${edge.id}`,
        code: 'DUPLICATE_EDGE_ID',
      });
    }
    edgeIndex.set(edge.id, edge);
  }

  // Validate edges reference existing nodes
  for (const edge of schema.edges) {
    if (!nodeIndex.has(edge.sourceId)) {
      errors.push({
        type: 'edge',
        targetId: edge.id,
        message: `Edge references non-existent source node: ${edge.sourceId}`,
        code: 'INVALID_SOURCE_NODE',
      });
    }
    if (!nodeIndex.has(edge.targetId)) {
      errors.push({
        type: 'edge',
        targetId: edge.id,
        message: `Edge references non-existent target node: ${edge.targetId}`,
        code: 'INVALID_TARGET_NODE',
      });
    }
  }

  // Validate trigger nodes
  const triggerNodes = schema.nodes.filter(n => n.category === 'trigger');
  if (schema.nodes.length > 0 && triggerNodes.length === 0) {
    warnings.push({
      type: 'flow',
      message: 'Flow has no trigger node',
      code: 'NO_TRIGGER_NODE',
    });
  }

  // Validate trigger node reference
  if (schema.triggerNodeId && !nodeIndex.has(schema.triggerNodeId)) {
    errors.push({
      type: 'flow',
      field: 'triggerNodeId',
      message: `Trigger node ID references non-existent node: ${schema.triggerNodeId}`,
      code: 'INVALID_TRIGGER_NODE_REF',
    });
  }

  // Check for cycles
  if (hasCycle(schema.nodes, schema.edges)) {
    warnings.push({
      type: 'flow',
      message: 'Flow contains a cycle',
      code: 'FLOW_HAS_CYCLE',
    });
  }

  // Check for unreachable nodes
  const reachable = getReachableNodeIds(schema.nodes, schema.edges);
  for (const node of schema.nodes) {
    if (node.category !== 'trigger' && !reachable.has(node.id)) {
      warnings.push({
        type: 'node',
        targetId: node.id,
        message: `Node "${node.label}" is not reachable from any trigger`,
        code: 'NODE_UNREACHABLE',
      });
    }
  }

  // Validate node-specific configurations
  for (const node of schema.nodes) {
    validateNodeConfig(node, errors, warnings);
  }

  // Validate edge conditions
  for (const edge of schema.edges) {
    if (edge.type === 'conditional' && !edge.condition) {
      warnings.push({
        type: 'edge',
        targetId: edge.id,
        message: 'Conditional edge has no condition expression',
        code: 'CONDITIONAL_NO_EXPRESSION',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate node-specific configuration
 */
function validateNodeConfig(
  node: NodeData,
  errors: FlowValidationError[],
  warnings: FlowValidationWarning[]
): void {
  switch (node.type) {
    case 'trigger:schedule':
      if (!node.config.cron && !node.config.interval) {
        errors.push({
          type: 'node',
          targetId: node.id,
          field: 'config',
          message: 'Schedule trigger requires cron expression or interval',
          code: 'SCHEDULE_CONFIG_REQUIRED',
        });
      }
      break;

    case 'trigger:webhook':
      if (!node.config.path && !node.config.endpoint) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          field: 'config.path',
          message: 'Webhook trigger has no path configured',
          code: 'WEBHOOK_NO_PATH',
        });
      }
      break;

    case 'action:http':
      if (!node.config.url) {
        errors.push({
          type: 'node',
          targetId: node.id,
          field: 'config.url',
          message: 'HTTP action requires URL',
          code: 'HTTP_URL_REQUIRED',
        });
      }
      break;

    case 'action:query':
      if (!node.config.tableId && !node.config.query) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          field: 'config',
          message: 'Query action has no table or query configured',
          code: 'QUERY_CONFIG_MISSING',
        });
      }
      break;

    case 'logic:condition':
      if (!node.config.condition) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          field: 'config.condition',
          message: 'Condition node has no condition expression',
          code: 'CONDITION_EMPTY',
        });
      }
      break;

    case 'logic:loop':
      if (!node.config.items && !node.config.count) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          field: 'config',
          message: 'Loop node has no items or count configured',
          code: 'LOOP_CONFIG_MISSING',
        });
      }
      break;
  }
}

/**
 * Check if the graph has a cycle
 */
function hasCycle(nodes: NodeData[], edges: EdgeData[]): boolean {
  const adjacencyList = new Map<string, string[]>();
  
  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }
  
  for (const edge of edges) {
    const list = adjacencyList.get(edge.sourceId);
    if (list) {
      list.push(edge.targetId);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Get IDs of nodes reachable from trigger nodes
 */
function getReachableNodeIds(nodes: NodeData[], edges: EdgeData[]): Set<string> {
  const reachable = new Set<string>();
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }

  for (const edge of edges) {
    const list = adjacencyList.get(edge.sourceId);
    if (list) {
      list.push(edge.targetId);
    }
  }

  // Find trigger nodes
  const triggerNodes = nodes.filter(n => n.category === 'trigger');

  // BFS from each trigger
  for (const trigger of triggerNodes) {
    const queue = [trigger.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      const neighbors = adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        queue.push(neighbor);
      }
    }
  }

  return reachable;
}

// ============================================================================
// Export
// ============================================================================

export {
  NodeDataSchema,
  EdgeDataSchema,
  FlowVariableSchema,
  FlowInputSchema,
  FlowOutputSchema,
  FlowSettingsSchema,
};
