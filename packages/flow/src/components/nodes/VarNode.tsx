/**
 * Variable Node Component
 * 
 * Node for variable operations.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { NodeIndexOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, VarNodeProps as VarPropsType } from '../../types';

const { Text } = Typography;

export interface VarNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: VarPropsType };
}

const operationLabels: Record<string, string> = {
  set: 'Set',
  increment: 'Increment',
  decrement: 'Decrement',
  append: 'Append',
  remove: 'Remove',
};

export const VarNode: React.FC<VarNodeProps> = ({ node, ...props }) => {
  const varName = node.props?.name;
  const operation = node.props?.operation || 'set';

  return (
    <BaseNode
      node={node}
      icon={<NodeIndexOutlined />}
      color="#eb2f96"
      {...props}
    >
      <Space direction="vertical" size={4}>
        {varName && (
          <Text code style={{ fontSize: 11 }}>
            {varName}
          </Text>
        )}
        <Tag color="magenta" style={{ margin: 0, fontSize: 11 }}>
          {operationLabels[operation] || operation}
        </Tag>
      </Space>
    </BaseNode>
  );
};

export default VarNode;
