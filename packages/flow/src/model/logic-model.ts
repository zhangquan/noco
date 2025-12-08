/**
 * Logic Model - Core operations for flow schema manipulation
 * 
 * Provides CRUD operations for flow nodes with immutable updates.
 */

import { produce } from 'immer';
import { nanoid } from 'nanoid';
import type {
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  FlowNodeTypes,
  FlowNodeProps,
  NodePath,
  FindNodeResult,
} from '../types';

/**
 * Generate a unique node ID
 */
export function generateNodeId(): string {
  return nanoid(10);
}

/**
 * Find a node by ID in the schema tree
 */
export function findNodeById(
  schema: FlowSchemaType,
  nodeId: string
): FindNodeResult | null {
  // Check root node
  if (schema.id === nodeId) {
    return {
      node: schema as unknown as FlowNodeType,
      parent: schema,
      path: [],
      index: -1,
    };
  }

  // Recursive search in actions
  function searchInActions(
    nodes: FlowNodeType[],
    parent: FlowNodeType | FlowSchemaType | FlowConditionNodeType,
    path: NodePath
  ): FindNodeResult | null {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.id === nodeId) {
        return {
          node,
          parent,
          path: [...path, { type: 'actions', index: i }],
          index: i,
        };
      }

      // Search in children
      if (node.actions) {
        const found = searchInActions(node.actions, node, [
          ...path,
          { type: 'actions', index: i },
        ]);
        if (found) return found;
      }

      // Search in conditions
      if (node.conditions) {
        for (let j = 0; j < node.conditions.length; j++) {
          const condition = node.conditions[j];
          if (condition.id === nodeId) {
            return {
              node: condition,
              parent: node,
              path: [...path, { type: 'actions', index: i }, { type: 'conditions', index: j }],
              index: j,
            };
          }

          // Search in condition's actions
          if (condition.actions) {
            const found = searchInActions(condition.actions, condition, [
              ...path,
              { type: 'actions', index: i },
              { type: 'conditions', index: j },
            ]);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  if (schema.actions) {
    return searchInActions(schema.actions, schema, []);
  }

  return null;
}

/**
 * Get a node by ID
 */
export function getNode(
  schema: FlowSchemaType,
  nodeId: string
): FlowNodeType | FlowConditionNodeType | null {
  const result = findNodeById(schema, nodeId);
  return result ? result.node : null;
}

/**
 * Add a node to the schema
 */
export function addNode(
  schema: FlowSchemaType,
  parentId: string,
  node: FlowNodeType,
  index?: number,
  containerType: 'actions' | 'conditions' = 'actions'
): FlowSchemaType {
  return produce(schema, (draft) => {
    const parent = findNodeById(draft, parentId);
    if (!parent) return;

    const parentNode = parent.node as FlowNodeType;

    if (containerType === 'conditions') {
      if (!parentNode.conditions) {
        parentNode.conditions = [];
      }
      const conditionNode = node as unknown as FlowConditionNodeType;
      if (typeof index === 'number') {
        parentNode.conditions.splice(index, 0, conditionNode);
      } else {
        parentNode.conditions.push(conditionNode);
      }
    } else {
      if (!parentNode.actions) {
        parentNode.actions = [];
      }
      if (typeof index === 'number') {
        parentNode.actions.splice(index, 0, node);
      } else {
        parentNode.actions.push(node);
      }
    }
  });
}

/**
 * Update a node in the schema
 */
export function updateNode(
  schema: FlowSchemaType,
  nodeId: string,
  updates: Partial<FlowNodeType>
): FlowSchemaType {
  return produce(schema, (draft) => {
    const result = findNodeById(draft, nodeId);
    if (!result) return;

    Object.assign(result.node, updates);
  });
}

/**
 * Update node props
 */
export function updateNodeProps(
  schema: FlowSchemaType,
  nodeId: string,
  props: Partial<FlowNodeProps>
): FlowSchemaType {
  return produce(schema, (draft) => {
    const result = findNodeById(draft, nodeId);
    if (!result) return;

    if (!result.node.props) {
      result.node.props = {};
    }
    Object.assign(result.node.props, props);
  });
}

/**
 * Remove a node from the schema
 */
export function removeNode(
  schema: FlowSchemaType,
  nodeId: string
): FlowSchemaType {
  return produce(schema, (draft) => {
    const result = findNodeById(draft, nodeId);
    if (!result || result.index === -1) return; // Can't remove root

    const parent = result.parent as FlowNodeType;
    const lastPathItem = result.path[result.path.length - 1];

    if (lastPathItem?.type === 'conditions') {
      parent.conditions?.splice(result.index, 1);
    } else {
      parent.actions?.splice(result.index, 1);
    }
  });
}

/**
 * Move a node to a new position
 */
export function moveNode(
  schema: FlowSchemaType,
  nodeId: string,
  newParentId: string,
  newIndex: number,
  containerType: 'actions' | 'conditions' = 'actions'
): FlowSchemaType {
  const nodeResult = findNodeById(schema, nodeId);
  if (!nodeResult || nodeResult.index === -1) return schema;

  // First remove the node
  let updatedSchema = removeNode(schema, nodeId);
  
  // Then add it to the new position
  updatedSchema = addNode(
    updatedSchema,
    newParentId,
    nodeResult.node as FlowNodeType,
    newIndex,
    containerType
  );

  return updatedSchema;
}

/**
 * Clone a node (deep copy with new IDs)
 */
export function cloneNode(node: FlowNodeType): FlowNodeType {
  const clone: FlowNodeType = {
    ...node,
    id: generateNodeId(),
    props: node.props ? { ...node.props } : undefined,
  };

  if (node.actions) {
    clone.actions = node.actions.map(cloneNode);
  }

  if (node.conditions) {
    clone.conditions = node.conditions.map((condition) => ({
      ...condition,
      id: generateNodeId(),
      props: condition.props ? { ...condition.props } : undefined,
      actions: condition.actions.map(cloneNode),
    }));
  }

  return clone;
}

/**
 * Duplicate a node in place
 */
export function duplicateNode(
  schema: FlowSchemaType,
  nodeId: string
): FlowSchemaType {
  const result = findNodeById(schema, nodeId);
  if (!result || result.index === -1) return schema;

  const cloned = cloneNode(result.node as FlowNodeType);
  const parentId = (result.parent as FlowNodeType).id;
  const lastPathItem = result.path[result.path.length - 1];

  return addNode(
    schema,
    parentId,
    cloned,
    result.index + 1,
    lastPathItem?.type || 'actions'
  );
}

/**
 * Create a new flow schema with default event node
 */
export function createDefaultSchema(): FlowSchemaType {
  return {
    id: generateNodeId(),
    actionType: 'event' as FlowNodeTypes.EVENT,
    props: {
      title: 'New Flow',
    },
    actions: [],
  };
}

/**
 * Create a new node with default props
 */
export function createNode(
  actionType: FlowNodeTypes,
  props?: FlowNodeProps
): FlowNodeType {
  const node: FlowNodeType = {
    id: generateNodeId(),
    actionType,
    props: props || { title: '' },
  };

  // Add default structure for special node types
  if (actionType === 'if' as FlowNodeTypes) {
    node.conditions = [
      {
        id: generateNodeId(),
        actionType: 'condition' as FlowNodeTypes.CONDITION,
        props: { title: 'Condition 1' },
        actions: [],
      },
      {
        id: generateNodeId(),
        actionType: 'condition' as FlowNodeTypes.CONDITION,
        props: { title: 'Default' },
        actions: [],
      },
    ];
  } else if (
    actionType === 'event' as FlowNodeTypes ||
    actionType === 'loop' as FlowNodeTypes
  ) {
    node.actions = [];
  }

  return node;
}

/**
 * Validate the flow schema
 */
export function validateSchema(schema: FlowSchemaType): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Root must be event type
  if (schema.actionType !== 'event') {
    errors.push('Root node must be of type "event"');
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  function collectIds(node: FlowNodeType | FlowConditionNodeType) {
    if (ids.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    ids.add(node.id);

    if ('actions' in node && node.actions) {
      node.actions.forEach(collectIds);
    }
    if ('conditions' in node && node.conditions) {
      node.conditions.forEach(collectIds);
    }
  }
  collectIds(schema as unknown as FlowNodeType);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all node IDs in the schema
 */
export function getAllNodeIds(schema: FlowSchemaType): string[] {
  const ids: string[] = [];

  function collect(node: FlowNodeType | FlowConditionNodeType) {
    ids.push(node.id);
    if ('actions' in node && node.actions) {
      node.actions.forEach(collect);
    }
    if ('conditions' in node && node.conditions) {
      node.conditions.forEach(collect);
    }
  }

  collect(schema as unknown as FlowNodeType);
  return ids;
}

/**
 * Count total nodes in the schema
 */
export function countNodes(schema: FlowSchemaType): number {
  return getAllNodeIds(schema).length;
}
