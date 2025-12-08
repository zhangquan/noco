/**
 * If Node Component
 * 
 * Conditional branching node.
 */

import React from 'react';
import { Tag, Space, Typography } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, ConditionNodeProps as ConditionPropsType } from '../../types';

const { Text } = Typography;

export interface IfNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: ConditionPropsType };
}

export const IfNode: React.FC<IfNodeProps> = ({ node, ...props }) => {
  const conditionCount = node.conditions?.length || 0;

  return (
    <BaseNode
      node={node}
      icon={<BranchesOutlined />}
      color="#faad14"
      badge={conditionCount > 0 ? conditionCount : undefined}
      {...props}
    >
      <Space direction="vertical" size={4}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
        </Text>
        {node.conditions?.slice(0, 2).map((condition, index) => (
          <Tag key={condition.id} style={{ margin: 0, fontSize: 11 }}>
            {String(condition.props?.title || `Condition ${index + 1}`)}
          </Tag>
        ))}
        {conditionCount > 2 && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            +{conditionCount - 2} more
          </Text>
        )}
      </Space>
    </BaseNode>
  );
};

export default IfNode;
