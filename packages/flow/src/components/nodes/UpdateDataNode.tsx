/**
 * Update Data Node Component
 * 
 * Node for updating data in a table.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, DataUpdateNodeProps as DataUpdatePropsType } from '../../types';
import { isExpression } from '../../types';

const { Text } = Typography;

export interface UpdateDataNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: DataUpdatePropsType };
}

export const UpdateDataNode: React.FC<UpdateDataNodeProps> = ({ node, ...props }) => {
  const fieldCount = node.props?.body 
    ? Object.keys(node.props.body).length 
    : 0;
  const hasRowId = node.props?.rowId;
  const hasFilters = (node.props?.filters?.length || 0) > 0;

  return (
    <BaseNode
      node={node}
      icon={<EditOutlined />}
      color="#1890ff"
      {...props}
    >
      <Space direction="vertical" size={4}>
        {node.props?.tableId && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Table: {node.props.tableId}
          </Text>
        )}
        <Space size={4} wrap>
          {fieldCount > 0 && (
            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            </Tag>
          )}
          {hasRowId && (
            <Tag style={{ margin: 0, fontSize: 11 }}>
              Single Row
            </Tag>
          )}
          {hasFilters && (
            <Tag style={{ margin: 0, fontSize: 11 }}>
              Bulk Update
            </Tag>
          )}
        </Space>
      </Space>
    </BaseNode>
  );
};

export default UpdateDataNode;
