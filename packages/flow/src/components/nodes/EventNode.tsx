/**
 * Event Node Component
 * 
 * Root trigger node for flows.
 */

import React from 'react';
import { Tag, Space, Typography } from 'antd';
import {
  ThunderboltOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, EventNodeProps as EventPropsType, FlowEventTypes } from '../../types';

const { Text } = Typography;

export interface EventNodeProps extends Omit<BaseNodeProps, 'icon' | 'color'> {
  node: FlowNodeType & { props?: EventPropsType };
}

const eventTypeConfig: Record<FlowEventTypes | string, {
  icon: React.ReactNode;
  color: string;
  label: string;
}> = {
  insert: {
    icon: <PlusCircleOutlined />,
    color: '#52c41a',
    label: 'On Create',
  },
  update: {
    icon: <EditOutlined />,
    color: '#1890ff',
    label: 'On Update',
  },
  delete: {
    icon: <DeleteOutlined />,
    color: '#ff4d4f',
    label: 'On Delete',
  },
  timer: {
    icon: <ClockCircleOutlined />,
    color: '#722ed1',
    label: 'Scheduled',
  },
  manual: {
    icon: <PlayCircleOutlined />,
    color: '#eb2f96',
    label: 'Manual',
  },
  webhook: {
    icon: <ApiOutlined />,
    color: '#fa8c16',
    label: 'Webhook',
  },
};

export const EventNode: React.FC<EventNodeProps> = ({ node, ...props }) => {
  const eventType = node.props?.eventType;
  const config = eventType ? eventTypeConfig[eventType] : null;

  return (
    <BaseNode
      node={node}
      icon={config?.icon || <ThunderboltOutlined />}
      color={config?.color || '#722ed1'}
      {...props}
    >
      <Space direction="vertical" size={4}>
        {config && (
          <Tag color={config.color} style={{ margin: 0 }}>
            {config.label}
          </Tag>
        )}
        {node.props?.tableId && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Table: {node.props.tableId}
          </Text>
        )}
      </Space>
    </BaseNode>
  );
};

export default EventNode;
