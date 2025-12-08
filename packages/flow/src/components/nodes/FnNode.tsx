/**
 * Function Node Component
 * 
 * Node for executing functions.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { FunctionOutlined, CodeOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, FnNodeProps as FnPropsType } from '../../types';

const { Text } = Typography;

export interface FnNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: FnPropsType };
}

export const FnNode: React.FC<FnNodeProps> = ({ node, ...props }) => {
  const fnName = node.props?.fnName;
  const hasCode = !!node.props?.code;
  const argCount = node.props?.args?.length || 0;

  return (
    <BaseNode
      node={node}
      icon={hasCode ? <CodeOutlined /> : <FunctionOutlined />}
      color="#722ed1"
      {...props}
    >
      <Space direction="vertical" size={4}>
        {fnName && (
          <Text code style={{ fontSize: 11 }}>
            {fnName}()
          </Text>
        )}
        {hasCode && (
          <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
            Custom Code
          </Tag>
        )}
        {argCount > 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {argCount} argument{argCount !== 1 ? 's' : ''}
          </Text>
        )}
      </Space>
    </BaseNode>
  );
};

export default FnNode;
