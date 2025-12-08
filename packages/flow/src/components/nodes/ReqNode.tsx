/**
 * Request (DataList) Node Component
 * 
 * Node for querying data from a table.
 */

import React from 'react';
import { Space, Typography, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, DataListNodeProps as DataListPropsType } from '../../types';

const { Text } = Typography;

export interface ReqNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: DataListPropsType };
}

export const ReqNode: React.FC<ReqNodeProps> = ({ node, ...props }) => {
  const filterCount = node.props?.filters?.length || 0;
  const limit = node.props?.limit;

  return (
    <BaseNode
      node={node}
      icon={<SearchOutlined />}
      color="#13c2c2"
      {...props}
    >
      <Space direction="vertical" size={4}>
        {node.props?.tableId && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Table: {node.props.tableId}
          </Text>
        )}
        <Space size={4}>
          {filterCount > 0 && (
            <Tag style={{ margin: 0, fontSize: 11 }}>
              {filterCount} filter{filterCount !== 1 ? 's' : ''}
            </Tag>
          )}
          {limit && (
            <Tag style={{ margin: 0, fontSize: 11 }}>
              Limit: {String(limit)}
            </Tag>
          )}
        </Space>
      </Space>
    </BaseNode>
  );
};

export default ReqNode;
