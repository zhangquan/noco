/**
 * Insert Data Node Component
 * 
 * Node for inserting data into a table.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { PlusSquareOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, DataInsertNodeProps as DataInsertPropsType } from '../../types';

const { Text } = Typography;

export interface InsertDataNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: DataInsertPropsType };
}

export const InsertDataNode: React.FC<InsertDataNodeProps> = ({ node, ...props }) => {
  const fieldCount = node.props?.body 
    ? Object.keys(node.props.body).length 
    : 0;

  return (
    <BaseNode
      node={node}
      icon={<PlusSquareOutlined />}
      color="#52c41a"
      {...props}
    >
      <Space direction="vertical" size={4}>
        {node.props?.tableId && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Table: {node.props.tableId}
          </Text>
        )}
        {fieldCount > 0 && (
          <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </Tag>
        )}
      </Space>
    </BaseNode>
  );
};

export default InsertDataNode;
