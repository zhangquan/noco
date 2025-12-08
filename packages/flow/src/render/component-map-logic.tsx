/**
 * Component Map Logic
 * Maps node types to components for design-time rendering
 * @module render/component-map-logic
 */

import React from 'react';
import {
  EventNode,
  IfNode,
  ConditionNode,
  DataListNode,
  DataInsertNode,
  DataUpdateNode,
  DataDeleteNode,
  BaseNode,
} from '../components/nodes';
import { FlowNodeTypes, type NodeRendererProps } from '../types';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  CodeOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StopOutlined,
  FunctionOutlined,
} from '@ant-design/icons';

// ============================================================================
// Node Component Map
// ============================================================================

/**
 * Map of node types to their components
 */
export const nodeComponentMap: Record<FlowNodeTypes, React.ComponentType<NodeRendererProps>> = {
  [FlowNodeTypes.EVENT]: EventNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.DATALIST]: DataListNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.DATAINSERT]: DataInsertNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.DATAUPDATE]: DataUpdateNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.DATADELETE]: DataDeleteNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.IF]: IfNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.CONDITION]: ConditionNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.LOOP]: LoopNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.VAR]: VarNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.FN]: FnNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.HTTP]: HttpNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.DELAY]: DelayNode as React.ComponentType<NodeRendererProps>,
  [FlowNodeTypes.END]: EndNode as React.ComponentType<NodeRendererProps>,
};

// ============================================================================
// Additional Node Components
// ============================================================================

/**
 * Loop Node
 */
function LoopNode(props: NodeRendererProps) {
  return (
    <BaseNode
      {...props}
      color="purple"
      icon={<ReloadOutlined />}
      typeLabel="循环"
    >
      <div style={{ color: 'rgba(0,0,0,0.45)' }}>
        循环执行子节点
      </div>
    </BaseNode>
  );
}

/**
 * Variable Node
 */
function VarNode(props: NodeRendererProps) {
  const varProps = props.node.props as { name?: string; value?: unknown } | undefined;
  return (
    <BaseNode
      {...props}
      color="purple"
      icon={<CodeOutlined />}
      typeLabel="变量"
    >
      {varProps?.name && (
        <div>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>变量名:</span>
          <code style={{ marginLeft: 4, padding: '1px 4px', background: '#f5f5f5', borderRadius: 2 }}>
            {varProps.name}
          </code>
        </div>
      )}
    </BaseNode>
  );
}

/**
 * Function Node
 */
function FnNode(props: NodeRendererProps) {
  const fnProps = props.node.props as { fnName?: string } | undefined;
  return (
    <BaseNode
      {...props}
      color="purple"
      icon={<FunctionOutlined />}
      typeLabel="函数"
    >
      {fnProps?.fnName && (
        <div>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>函数:</span>
          <code style={{ marginLeft: 4, padding: '1px 4px', background: '#f5f5f5', borderRadius: 2 }}>
            {fnProps.fnName}
          </code>
        </div>
      )}
    </BaseNode>
  );
}

/**
 * HTTP Request Node
 */
function HttpNode(props: NodeRendererProps) {
  const httpProps = props.node.props as { url?: string; method?: string } | undefined;
  return (
    <BaseNode
      {...props}
      color="blue"
      icon={<ApiOutlined />}
      typeLabel="HTTP"
    >
      {httpProps?.url && (
        <div>
          <span style={{
            marginRight: 4,
            padding: '1px 4px',
            background: '#e6f4ff',
            borderRadius: 2,
            fontSize: 12,
            fontWeight: 500,
          }}>
            {httpProps.method || 'GET'}
          </span>
          <span style={{ wordBreak: 'break-all' }}>{httpProps.url}</span>
        </div>
      )}
    </BaseNode>
  );
}

/**
 * Delay Node
 */
function DelayNode(props: NodeRendererProps) {
  const delayProps = props.node.props as { duration?: number; unit?: string } | undefined;
  return (
    <BaseNode
      {...props}
      color="gray"
      icon={<ClockCircleOutlined />}
      typeLabel="延时"
    >
      {delayProps?.duration && (
        <div>
          等待 {delayProps.duration} {delayProps.unit || 'ms'}
        </div>
      )}
    </BaseNode>
  );
}

/**
 * End Node
 */
function EndNode(props: NodeRendererProps) {
  return (
    <BaseNode
      {...props}
      color="red"
      icon={<StopOutlined />}
      typeLabel="结束"
    >
      <div style={{ color: 'rgba(0,0,0,0.45)' }}>
        流程结束
      </div>
    </BaseNode>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get component for a node type
 */
export function getNodeComponent(nodeType: FlowNodeTypes): React.ComponentType<NodeRendererProps> | null {
  return nodeComponentMap[nodeType] || null;
}

/**
 * Render a node using the component map
 */
export function renderNode(props: NodeRendererProps): React.ReactNode {
  const Component = getNodeComponent(props.node.actionType);
  if (!Component) {
    console.warn(`No component found for node type: ${props.node.actionType}`);
    return null;
  }
  return <Component {...props} />;
}

export default nodeComponentMap;
