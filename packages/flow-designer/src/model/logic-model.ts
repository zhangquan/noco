/**
 * Logic Model
 * Core logic model for flow node operations
 * @module model/logic-model
 */

import { nanoid } from 'nanoid';
import type {
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  FlowNodeTypes,
  FlowNodePropsType,
  NodePath,
  NodeWithPath,
  ExpressionType,
} from '../types';

// ============================================================================
// Node Factory Functions
// ============================================================================

/**
 * Create a new flow schema (root EVENT node)
 */
export function createFlowSchema(props?: Partial<FlowSchemaType['props']>): FlowSchemaType {
  return {
    id: nanoid(),
    actionType: 'event' as FlowNodeTypes.EVENT,
    props: {
      title: '新流程',
      ...props,
    },
    actions: [],
  };
}

/**
 * Create a new node based on type
 */
export function createNode(
  actionType: FlowNodeTypes,
  props?: Partial<FlowNodePropsType>
): FlowNodeType {
  const baseNode: FlowNodeType = {
    id: nanoid(),
    actionType,
    props: props as FlowNodePropsType,
  };

  // Add default structure based on node type
  switch (actionType) {
    case 'if' as FlowNodeTypes:
      baseNode.conditions = [
        createConditionBranch({ title: '条件 1' }),
        createConditionBranch({ title: '默认' }),
      ];
      break;
    case 'loop' as FlowNodeTypes:
      baseNode.actions = [];
      break;
    default:
      // Most nodes don't need child actions by default
      break;
  }

  return baseNode;
}

/**
 * Create a condition branch for IF nodes
 */
export function createConditionBranch(
  props?: Partial<FlowConditionNodeType['props']>
): FlowConditionNodeType {
  return {
    id: nanoid(),
    actionType: 'condition' as FlowNodeTypes.CONDITION,
    props: {
      title: '条件',
      ...props,
    },
    actions: [],
  };
}

/**
 * Create an expression value
 */
export function createExpression(value: string, label?: string): ExpressionType {
  return {
    type: 'expression',
    value,
    label,
  };
}

// ============================================================================
// Node Search Functions
// ============================================================================

/**
 * Find a node by ID in the schema tree
 */
export function findNodeById(
  schema: FlowSchemaType | FlowNodeType | null,
  nodeId: string
): FlowNodeType | null {
  if (!schema) return null;
  if (schema.id === nodeId) return schema as FlowNodeType;

  // Search in actions
  if (schema.actions) {
    for (const action of schema.actions) {
      const found = findNodeById(action, nodeId);
      if (found) return found;
    }
  }

  // Search in conditions
  if ('conditions' in schema && schema.conditions) {
    for (const condition of schema.conditions) {
      if (condition.id === nodeId) return condition as unknown as FlowNodeType;
      const found = findNodeById(condition as unknown as FlowNodeType, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find a node with its path and parent
 */
export function findNodeWithPath(
  schema: FlowSchemaType | FlowNodeType | null,
  nodeId: string,
  path: NodePath = [],
  parent?: FlowNodeType
): NodeWithPath | null {
  if (!schema) return null;

  if (schema.id === nodeId) {
    return { node: schema as FlowNodeType, path, parent };
  }

  const currentPath = [...path, schema.id];

  // Search in actions
  if (schema.actions) {
    for (const action of schema.actions) {
      const found = findNodeWithPath(action, nodeId, currentPath, schema as FlowNodeType);
      if (found) return found;
    }
  }

  // Search in conditions
  if ('conditions' in schema && schema.conditions) {
    for (const condition of schema.conditions) {
      if (condition.id === nodeId) {
        return {
          node: condition as unknown as FlowNodeType,
          path: currentPath,
          parent: schema as FlowNodeType,
        };
      }
      const found = findNodeWithPath(
        condition as unknown as FlowNodeType,
        nodeId,
        currentPath,
        schema as FlowNodeType
      );
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find parent node of a given node
 */
export function findParentNode(
  schema: FlowSchemaType | FlowNodeType | null,
  nodeId: string
): FlowNodeType | null {
  const result = findNodeWithPath(schema, nodeId);
  return result?.parent || null;
}

/**
 * Get all nodes in the schema as a flat array
 */
export function getAllNodes(schema: FlowSchemaType | null): FlowNodeType[] {
  if (!schema) return [];

  const nodes: FlowNodeType[] = [schema as unknown as FlowNodeType];

  function traverse(node: FlowNodeType) {
    if (node.actions) {
      for (const action of node.actions) {
        nodes.push(action);
        traverse(action);
      }
    }
    if ('conditions' in node && node.conditions) {
      for (const condition of node.conditions) {
        nodes.push(condition as unknown as FlowNodeType);
        traverse(condition as unknown as FlowNodeType);
      }
    }
  }

  traverse(schema as unknown as FlowNodeType);
  return nodes;
}

/**
 * Get node depth in the tree
 */
export function getNodeDepth(schema: FlowSchemaType | null, nodeId: string): number {
  const result = findNodeWithPath(schema, nodeId);
  return result?.path.length || 0;
}

// ============================================================================
// Node Mutation Functions
// ============================================================================

/**
 * Add a node as a child of the target node
 * Returns a new schema (immutable)
 */
export function addNode(
  schema: FlowSchemaType,
  parentId: string,
  newNode: FlowNodeType,
  index?: number
): FlowSchemaType {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const parent = findNodeById(cloned, parentId);

  if (!parent) {
    console.warn(`Parent node not found: ${parentId}`);
    return cloned;
  }

  if (!parent.actions) {
    parent.actions = [];
  }

  if (index !== undefined && index >= 0 && index <= parent.actions.length) {
    parent.actions.splice(index, 0, newNode);
  } else {
    parent.actions.push(newNode);
  }

  return cloned;
}

/**
 * Update a node's properties
 * Returns a new schema (immutable)
 */
export function updateNode(
  schema: FlowSchemaType,
  nodeId: string,
  updates: Partial<FlowNodeType>
): FlowSchemaType {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const node = findNodeById(cloned, nodeId);

  if (!node) {
    console.warn(`Node not found: ${nodeId}`);
    return cloned;
  }

  Object.assign(node, updates);
  return cloned;
}

/**
 * Update a node's props
 * Returns a new schema (immutable)
 */
export function updateNodeProps(
  schema: FlowSchemaType,
  nodeId: string,
  props: Partial<FlowNodePropsType>
): FlowSchemaType {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const node = findNodeById(cloned, nodeId);

  if (!node) {
    console.warn(`Node not found: ${nodeId}`);
    return cloned;
  }

  node.props = { ...node.props, ...props } as FlowNodePropsType;
  return cloned;
}

/**
 * Remove a node from the schema
 * Returns a new schema (immutable)
 */
export function removeNode(schema: FlowSchemaType, nodeId: string): FlowSchemaType {
  // Don't remove root node
  if (schema.id === nodeId) {
    console.warn('Cannot remove root node');
    return schema;
  }

  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  
  function remove(node: FlowNodeType | FlowSchemaType): boolean {
    // Check actions
    if (node.actions) {
      const index = node.actions.findIndex((a) => a.id === nodeId);
      if (index !== -1) {
        node.actions.splice(index, 1);
        return true;
      }
      for (const action of node.actions) {
        if (remove(action)) return true;
      }
    }

    // Check conditions
    if ('conditions' in node && node.conditions) {
      const index = node.conditions.findIndex((c) => c.id === nodeId);
      if (index !== -1) {
        // Don't remove if it's the last two branches
        if (node.conditions.length > 2) {
          node.conditions.splice(index, 1);
          return true;
        }
        console.warn('Cannot remove condition: minimum 2 branches required');
        return false;
      }
      for (const condition of node.conditions) {
        if (remove(condition as unknown as FlowNodeType)) return true;
      }
    }

    return false;
  }

  remove(cloned);
  return cloned;
}

/**
 * Move a node to a new parent
 * Returns a new schema (immutable)
 */
export function moveNode(
  schema: FlowSchemaType,
  nodeId: string,
  newParentId: string,
  newIndex: number
): FlowSchemaType {
  // Don't move root node
  if (schema.id === nodeId) {
    console.warn('Cannot move root node');
    return schema;
  }

  const nodeWithPath = findNodeWithPath(schema, nodeId);
  if (!nodeWithPath) {
    console.warn(`Node not found: ${nodeId}`);
    return schema;
  }

  // Clone the node
  const nodeCopy = JSON.parse(JSON.stringify(nodeWithPath.node));

  // Remove from old location
  let newSchema = removeNode(schema, nodeId);

  // Add to new location
  newSchema = addNode(newSchema, newParentId, nodeCopy, newIndex);

  return newSchema;
}

/**
 * Duplicate a node
 * Returns a new schema and the new node ID (immutable)
 */
export function duplicateNode(
  schema: FlowSchemaType,
  nodeId: string
): { schema: FlowSchemaType; newNodeId: string | null } {
  const nodeWithPath = findNodeWithPath(schema, nodeId);
  if (!nodeWithPath || !nodeWithPath.parent) {
    console.warn(`Node not found or is root: ${nodeId}`);
    return { schema, newNodeId: null };
  }

  // Clone with new IDs
  const clonedNode = cloneNodeWithNewIds(nodeWithPath.node);

  // Find index in parent
  const parent = nodeWithPath.parent;
  let index = -1;
  if (parent.actions) {
    index = parent.actions.findIndex((a) => a.id === nodeId);
  }

  // Add after the original
  const newSchema = addNode(schema, parent.id, clonedNode, index + 1);

  return { schema: newSchema, newNodeId: clonedNode.id };
}

/**
 * Clone a node with new IDs for all nested nodes
 */
export function cloneNodeWithNewIds(node: FlowNodeType): FlowNodeType {
  const cloned: FlowNodeType = {
    ...node,
    id: nanoid(),
    props: node.props ? { ...node.props } : undefined,
    actions: node.actions?.map(cloneNodeWithNewIds),
    conditions: node.conditions?.map((c) => ({
      ...c,
      id: nanoid(),
      props: c.props ? { ...c.props } : undefined,
      actions: c.actions.map(cloneNodeWithNewIds),
    })),
  };
  return cloned;
}

// ============================================================================
// Condition Branch Functions
// ============================================================================

/**
 * Add a condition branch to an IF node
 */
export function addConditionBranch(
  schema: FlowSchemaType,
  ifNodeId: string,
  branch?: Partial<FlowConditionNodeType>,
  index?: number
): { schema: FlowSchemaType; branchId: string | null } {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const ifNode = findNodeById(cloned, ifNodeId);

  if (!ifNode || ifNode.actionType !== ('if' as FlowNodeTypes)) {
    console.warn(`IF node not found: ${ifNodeId}`);
    return { schema: cloned, branchId: null };
  }

  if (!ifNode.conditions) {
    ifNode.conditions = [];
  }

  const newBranch = createConditionBranch(branch?.props);
  if (branch?.actions) {
    newBranch.actions = branch.actions;
  }

  // Insert before the default branch (last one)
  const insertIndex = index !== undefined
    ? Math.min(index, ifNode.conditions.length - 1)
    : Math.max(0, ifNode.conditions.length - 1);

  ifNode.conditions.splice(insertIndex, 0, newBranch);

  return { schema: cloned, branchId: newBranch.id };
}

/**
 * Update a condition branch
 */
export function updateConditionBranch(
  schema: FlowSchemaType,
  ifNodeId: string,
  branchId: string,
  updates: Partial<FlowConditionNodeType>
): FlowSchemaType {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const ifNode = findNodeById(cloned, ifNodeId);

  if (!ifNode || !ifNode.conditions) {
    console.warn(`IF node not found: ${ifNodeId}`);
    return cloned;
  }

  const branch = ifNode.conditions.find((c) => c.id === branchId);
  if (!branch) {
    console.warn(`Branch not found: ${branchId}`);
    return cloned;
  }

  Object.assign(branch, updates);
  return cloned;
}

/**
 * Remove a condition branch
 */
export function removeConditionBranch(
  schema: FlowSchemaType,
  ifNodeId: string,
  branchId: string
): FlowSchemaType {
  const cloned = JSON.parse(JSON.stringify(schema)) as FlowSchemaType;
  const ifNode = findNodeById(cloned, ifNodeId);

  if (!ifNode || !ifNode.conditions) {
    console.warn(`IF node not found: ${ifNodeId}`);
    return cloned;
  }

  // Need at least 2 branches
  if (ifNode.conditions.length <= 2) {
    console.warn('Cannot remove branch: minimum 2 branches required');
    return cloned;
  }

  const index = ifNode.conditions.findIndex((c) => c.id === branchId);
  if (index !== -1 && index < ifNode.conditions.length - 1) {
    ifNode.conditions.splice(index, 1);
  }

  return cloned;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a flow schema
 */
export function validateSchema(schema: FlowSchemaType): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema.id) {
    errors.push('Schema must have an id');
  }

  if (schema.actionType !== ('event' as FlowNodeTypes.EVENT)) {
    errors.push('Root node must be EVENT type');
  }

  // Validate all nodes
  const allNodes = getAllNodes(schema);
  const ids = new Set<string>();

  for (const node of allNodes) {
    if (!node.id) {
      errors.push('All nodes must have an id');
    }
    if (ids.has(node.id)) {
      errors.push(`Duplicate node id: ${node.id}`);
    }
    ids.add(node.id);

    if (!node.actionType) {
      errors.push(`Node ${node.id} must have an actionType`);
    }

    // Validate IF nodes have conditions
    if (node.actionType === ('if' as FlowNodeTypes) && (!node.conditions || node.conditions.length < 2)) {
      errors.push(`IF node ${node.id} must have at least 2 condition branches`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Expression Functions
// ============================================================================

/**
 * Extract expression variables from a schema
 */
export function extractExpressionVariables(schema: FlowSchemaType): string[] {
  const variables = new Set<string>();
  const regex = /\{([^}]+)\}/g;

  function extractFromValue(value: unknown) {
    if (typeof value === 'object' && value !== null) {
      if ('type' in value && (value as ExpressionType).type === 'expression') {
        const expr = (value as ExpressionType).value;
        let match;
        while ((match = regex.exec(expr)) !== null) {
          variables.add(match[1]);
        }
      } else {
        Object.values(value).forEach(extractFromValue);
      }
    }
  }

  const allNodes = getAllNodes(schema);
  for (const node of allNodes) {
    if (node.props) {
      extractFromValue(node.props);
    }
  }

  return Array.from(variables);
}

/**
 * Get available variables at a specific node (based on previous nodes)
 */
export function getAvailableVariables(
  schema: FlowSchemaType,
  nodeId: string
): Array<{ name: string; type: string; source: string }> {
  const variables: Array<{ name: string; type: string; source: string }> = [];
  
  // Always available: eventData, context
  variables.push(
    { name: 'eventData', type: 'object', source: 'event' },
    { name: 'context.userId', type: 'string', source: 'context' },
    { name: 'context.projectId', type: 'string', source: 'context' },
    { name: 'context.timestamp', type: 'number', source: 'context' }
  );

  // Find all nodes that execute before this node
  const nodeWithPath = findNodeWithPath(schema, nodeId);
  if (!nodeWithPath) return variables;

  // Traverse and collect variables from previous nodes
  function collectVariables(node: FlowNodeType) {
    if (node.id === nodeId) return;

    const nodeType = node.actionType;
    const nodeTitle = (node.props as { title?: string })?.title || node.id;

    switch (nodeType) {
      case 'dataList' as FlowNodeTypes:
        variables.push({
          name: `flowData.${node.id}`,
          type: 'array',
          source: nodeTitle,
        });
        break;
      case 'dataInsert' as FlowNodeTypes:
      case 'dataUpdate' as FlowNodeTypes:
        variables.push({
          name: `flowData.${node.id}`,
          type: 'object',
          source: nodeTitle,
        });
        break;
      case 'var' as FlowNodeTypes:
        const varName = (node.props as { name?: string })?.name;
        if (varName) {
          variables.push({
            name: `flowData.${varName}`,
            type: 'any',
            source: nodeTitle,
          });
        }
        break;
      case 'http' as FlowNodeTypes:
        variables.push({
          name: `flowData.${node.id}`,
          type: 'object',
          source: nodeTitle,
        });
        break;
    }
  }

  // Traverse the path to this node
  let current: FlowNodeType | FlowSchemaType = schema;
  for (const pathId of nodeWithPath.path) {
    if (current.actions) {
      for (const action of current.actions) {
        if (action.id === nodeId) break;
        collectVariables(action);
        if (action.id === pathId) {
          current = action;
          break;
        }
      }
    }
  }

  return variables;
}

export default {
  createFlowSchema,
  createNode,
  createConditionBranch,
  createExpression,
  findNodeById,
  findNodeWithPath,
  findParentNode,
  getAllNodes,
  getNodeDepth,
  addNode,
  updateNode,
  updateNodeProps,
  removeNode,
  moveNode,
  duplicateNode,
  cloneNodeWithNewIds,
  addConditionBranch,
  updateConditionBranch,
  removeConditionBranch,
  validateSchema,
  extractExpressionVariables,
  getAvailableVariables,
};
