/**
 * Node Schema Tree utility functions
 * Provides tree traversal and manipulation utilities
 */

import type { NodeSchema } from '../types.js';
import { deepClone } from './utils.js';

/**
 * Callback function type for tree traversal
 */
export type TraverseCallback = (
  node: NodeSchema,
  parent: NodeSchema | null,
  index: number,
  depth: number
) => boolean | void;

/**
 * Traverse the tree in depth-first pre-order
 * Return false from callback to skip children
 */
export function traverseTree(
  node: NodeSchema,
  callback: TraverseCallback,
  parent: NodeSchema | null = null,
  index: number = 0,
  depth: number = 0
): void {
  const shouldContinue = callback(node, parent, index, depth);

  if (shouldContinue === false) {
    return;
  }

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child, childIndex) => {
      traverseTree(child, callback, node, childIndex, depth + 1);
    });
  }
}

/**
 * Traverse the tree in depth-first post-order
 * Children are processed before parent
 */
export function traverseTreePostOrder(
  node: NodeSchema,
  callback: TraverseCallback,
  parent: NodeSchema | null = null,
  index: number = 0,
  depth: number = 0
): void {
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child, childIndex) => {
      traverseTreePostOrder(child, callback, node, childIndex, depth + 1);
    });
  }

  callback(node, parent, index, depth);
}

/**
 * Map over tree nodes, creating a new tree
 */
export function mapTree(
  node: NodeSchema,
  mapper: (node: NodeSchema, depth: number) => NodeSchema,
  depth: number = 0
): NodeSchema {
  const mappedNode = mapper(deepClone(node), depth);

  if (mappedNode.children && Array.isArray(mappedNode.children)) {
    mappedNode.children = mappedNode.children.map(child =>
      mapTree(child, mapper, depth + 1)
    );
  }

  return mappedNode;
}

/**
 * Filter tree nodes based on predicate
 * Nodes that don't match are removed, but their children may still be included
 */
export function filterTree(
  node: NodeSchema,
  predicate: (node: NodeSchema) => boolean,
  keepDescendants: boolean = true
): NodeSchema | null {
  const nodeMatches = predicate(node);

  let filteredChildren: NodeSchema[] | undefined;
  if (node.children && Array.isArray(node.children)) {
    filteredChildren = node.children
      .map(child => filterTree(child, predicate, keepDescendants))
      .filter((child): child is NodeSchema => child !== null);
  }

  if (nodeMatches) {
    return {
      ...node,
      children: filteredChildren,
    };
  }

  if (keepDescendants && filteredChildren && filteredChildren.length > 0) {
    // If node doesn't match but has matching descendants, wrap them
    return {
      ...node,
      children: filteredChildren,
    };
  }

  return null;
}

/**
 * Find a node in the tree by predicate
 */
export function findNode(
  node: NodeSchema,
  predicate: (node: NodeSchema) => boolean
): NodeSchema | null {
  if (predicate(node)) {
    return node;
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNode(child, predicate);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Find all nodes matching a predicate
 */
export function findAllNodes(
  node: NodeSchema,
  predicate: (node: NodeSchema) => boolean
): NodeSchema[] {
  const results: NodeSchema[] = [];

  traverseTree(node, (n) => {
    if (predicate(n)) {
      results.push(n);
    }
  });

  return results;
}

/**
 * Find node by ID
 */
export function findNodeById(
  node: NodeSchema,
  id: string
): NodeSchema | null {
  return findNode(node, n => n.id === id);
}

/**
 * Find node by component name
 */
export function findNodeByComponentName(
  node: NodeSchema,
  componentName: string
): NodeSchema | null {
  return findNode(node, n => n.componentName === componentName);
}

/**
 * Get all leaf nodes (nodes without children)
 */
export function getLeafNodes(node: NodeSchema): NodeSchema[] {
  return findAllNodes(node, n => !n.children || n.children.length === 0);
}

/**
 * Get the depth of a tree
 */
export function getTreeDepth(node: NodeSchema): number {
  if (!node.children || node.children.length === 0) {
    return 1;
  }

  const childDepths = node.children.map(child => getTreeDepth(child));
  return 1 + Math.max(...childDepths);
}

/**
 * Count total nodes in tree
 */
export function countNodes(node: NodeSchema): number {
  let count = 1;

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }

  return count;
}

/**
 * Flatten tree to array
 */
export function flattenTree(node: NodeSchema): NodeSchema[] {
  const result: NodeSchema[] = [];
  traverseTree(node, n => {
    result.push(n);
  });
  return result;
}

/**
 * Get path from root to target node
 */
export function getNodePath(
  root: NodeSchema,
  targetId: string
): NodeSchema[] | null {
  const path: NodeSchema[] = [];

  function search(node: NodeSchema): boolean {
    path.push(node);

    if (node.id === targetId) {
      return true;
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (search(child)) {
          return true;
        }
      }
    }

    path.pop();
    return false;
  }

  return search(root) ? path : null;
}

/**
 * Clone a tree structure
 */
export function cloneTree(node: NodeSchema): NodeSchema {
  return deepClone(node);
}

/**
 * Replace a node in the tree by ID
 */
export function replaceNode(
  root: NodeSchema,
  targetId: string,
  replacement: NodeSchema
): NodeSchema {
  return mapTree(root, (node) => {
    if (node.id === targetId) {
      return { ...replacement };
    }
    return node;
  });
}

/**
 * Insert a node as a child at a specific index
 */
export function insertChild(
  parent: NodeSchema,
  child: NodeSchema,
  index: number = -1
): NodeSchema {
  const children = parent.children ? [...parent.children] : [];
  const insertIndex = index < 0 ? children.length : Math.min(index, children.length);
  children.splice(insertIndex, 0, child);

  return {
    ...parent,
    children,
  };
}

/**
 * Remove a child node by index
 */
export function removeChild(parent: NodeSchema, index: number): NodeSchema {
  if (!parent.children || index < 0 || index >= parent.children.length) {
    return parent;
  }

  const children = [...parent.children];
  children.splice(index, 1);

  return {
    ...parent,
    children,
  };
}

/**
 * Check if node is a container (has children capability)
 */
export function isContainer(node: NodeSchema): boolean {
  // Nodes with children array or specific container component names
  const containerComponents = ['Document', 'Page', 'Modal', 'Container', 'Div', 'View', 'Block'];
  return (
    (node.children !== undefined && Array.isArray(node.children)) ||
    containerComponents.includes(node.componentName)
  );
}

/**
 * Check if node is a slot
 */
export function isSlotNode(node: NodeSchema): boolean {
  return node.componentName === 'Slot' || node.slot !== undefined;
}

/**
 * Check if node is hidden
 */
export function isHiddenNode(node: NodeSchema): boolean {
  return node.hidden === true || node.props?.style?.display === 'none';
}

/**
 * Check if node has loop (is a repeated element)
 */
export function hasLoop(node: NodeSchema): boolean {
  return node.loop !== undefined && node.loop !== null;
}

/**
 * Check if node has condition
 */
export function hasCondition(node: NodeSchema): boolean {
  return node.condition !== undefined && node.condition !== null;
}
