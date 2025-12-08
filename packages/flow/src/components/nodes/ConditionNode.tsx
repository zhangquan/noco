/**
 * Condition Node Component
 * 
 * Individual condition branch within an IF node.
 */

import React from 'react';
import { Typography, Tag } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowConditionNodeType, ConditionNodeProps as ConditionPropsType } from '../../types';
import { isExpression } from '../../types';

const { Text } = Typography;

export interface ConditionNodeProps extends Omit<BaseNodeProps, 'icon' | 'color' | 'node'> {
  node: FlowConditionNodeType;
  isDefault?: boolean;
}

export const ConditionNode: React.FC<ConditionNodeProps> = ({
  node,
  isDefault = false,
  ...props
}) => {
  const expression = node.props?.expression;
  const hasExpression = expression && (
    typeof expression === 'string' ? expression.length > 0 : isExpression(expression)
  );

  return (
    <BaseNode
      node={node as any}
      icon={<QuestionCircleOutlined />}
      color={isDefault ? '#8c8c8c' : '#52c41a'}
      {...props}
    >
      {isDefault ? (
        <Tag color="default">Default Branch</Tag>
      ) : hasExpression ? (
        <Text
          type="secondary"
          style={{ fontSize: 11 }}
          ellipsis={{ tooltip: true }}
        >
          {typeof expression === 'string' 
            ? expression 
            : expression.value
          }
        </Text>
      ) : (
        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
          No condition set
        </Text>
      )}
    </BaseNode>
  );
};

export default ConditionNode;
