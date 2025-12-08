/**
 * Loop Node Component
 * 
 * Node for iterating over data.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, LoopNodeProps as LoopPropsType } from '../../types';
import { isExpression } from '../../types';

const { Text } = Typography;

export interface LoopNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: LoopPropsType };
}

export const LoopNode: React.FC<LoopNodeProps> = ({ node, ...props }) => {
  const source = node.props?.source;
  const itemVar = node.props?.itemVar || 'item';
  const maxIterations = node.props?.maxIterations;
  const childCount = node.actions?.length || 0;

  return (
    <BaseNode
      node={node}
      icon={<ReloadOutlined />}
      color="#fa541c"
      badge={childCount > 0 ? childCount : undefined}
      {...props}
    >
      <Space direction="vertical" size={4}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Item: <Text code style={{ fontSize: 11 }}>{itemVar}</Text>
        </Text>
        {isExpression(source) && (
          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
            Source: {source.value}
          </Text>
        )}
        {maxIterations && (
          <Tag style={{ margin: 0, fontSize: 11 }}>
            Max: {maxIterations}
          </Tag>
        )}
      </Space>
    </BaseNode>
  );
};

export default LoopNode;
