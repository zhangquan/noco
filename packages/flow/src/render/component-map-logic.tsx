/**
 * Component Map Logic
 * 
 * Maps node types to their React components for design-time rendering.
 */

import React from 'react';
import type { FlowNodeType, FlowConditionNodeType, FlowNodeTypes } from '../types';
import {
  EventNode,
  IfNode,
  ConditionNode,
  ReqNode,
  InsertDataNode,
  UpdateDataNode,
  VarNode,
  FnNode,
  LoopNode,
  BaseNode,
} from '../components/nodes';
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons';

export interface NodeComponentProps {
  node: FlowNodeType | FlowConditionNodeType;
  selected?: boolean;
  readonly?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  isDefault?: boolean;
}

/**
 * Get the component for a node type
 */
export function getNodeComponent(
  type: FlowNodeTypes | string
): React.ComponentType<NodeComponentProps> {
  const componentMap: Record<string, React.ComponentType<NodeComponentProps>> = {
    event: EventNode as React.ComponentType<NodeComponentProps>,
    dataList: ReqNode as React.ComponentType<NodeComponentProps>,
    dataInsert: InsertDataNode as React.ComponentType<NodeComponentProps>,
    dataUpdate: UpdateDataNode as React.ComponentType<NodeComponentProps>,
    dataDelete: createDeleteDataNode(),
    if: IfNode as React.ComponentType<NodeComponentProps>,
    condition: ConditionNode as React.ComponentType<NodeComponentProps>,
    var: VarNode as React.ComponentType<NodeComponentProps>,
    fn: FnNode as React.ComponentType<NodeComponentProps>,
    loop: LoopNode as React.ComponentType<NodeComponentProps>,
    message: createMessageNode(),
  };

  return componentMap[type] || createDefaultNode(type);
}

/**
 * Create a delete data node component
 */
function createDeleteDataNode(): React.ComponentType<NodeComponentProps> {
  return function DeleteDataNode({ node, ...props }) {
    return (
      <BaseNode
        node={node as FlowNodeType}
        icon={<DeleteOutlined />}
        color="#ff4d4f"
        {...props}
      />
    );
  };
}

/**
 * Create a message node component
 */
function createMessageNode(): React.ComponentType<NodeComponentProps> {
  return function MessageNode({ node, ...props }) {
    return (
      <BaseNode
        node={node as FlowNodeType}
        icon={<MessageOutlined />}
        color="#1890ff"
        {...props}
      />
    );
  };
}

/**
 * Create a default node component
 */
function createDefaultNode(type: string): React.ComponentType<NodeComponentProps> {
  return function DefaultNode({ node, ...props }) {
    return (
      <BaseNode
        node={node as FlowNodeType}
        color="#666"
        {...props}
      />
    );
  };
}

/**
 * Render a node with its component
 */
export function renderNode(
  node: FlowNodeType | FlowConditionNodeType,
  props: Omit<NodeComponentProps, 'node'>
): React.ReactNode {
  const Component = getNodeComponent(node.actionType);
  return <Component node={node} {...props} />;
}
