/**
 * EventNode Component
 * Event trigger node (root node)
 * @module components/nodes/EventNode
 */

import React, { useMemo } from 'react';
import {
  ThunderboltOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  FormOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type { FlowNodeType, EventNodeProps, FlowEventTypes } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface EventNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
}

// ============================================================================
// Constants
// ============================================================================

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  insert: { label: '创建数据时', icon: <PlusCircleOutlined />, color: 'green' },
  update: { label: '更新数据时', icon: <EditOutlined />, color: 'blue' },
  delete: { label: '删除数据时', icon: <DatabaseOutlined />, color: 'red' },
  timer: { label: '定时分析任务', icon: <ClockCircleOutlined />, color: 'orange' },
  webhook: { label: 'Webhook', icon: <ApiOutlined />, color: 'purple' },
  form: { label: '表单提交', icon: <FormOutlined />, color: 'cyan' },
  manual: { label: '手动触发', icon: <PlayCircleOutlined />, color: 'default' },
};

// ============================================================================
// Component
// ============================================================================

export const EventNode: React.FC<EventNodeComponentProps> = ({
  node,
  ...props
}) => {
  const eventProps = node.props as EventNodeProps | undefined;
  const eventType = eventProps?.eventType;

  const eventConfig = useMemo(() => {
    if (eventType && EVENT_TYPE_CONFIG[eventType]) {
      return EVENT_TYPE_CONFIG[eventType];
    }
    return { label: '事件触发', icon: <ThunderboltOutlined />, color: 'blue' };
  }, [eventType]);

  const content = useMemo(() => {
    const items: React.ReactNode[] = [];

    if (eventType) {
      items.push(
        <div key="event-type" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>触发方式:</span>
          <Tag icon={eventConfig.icon} color={eventConfig.color}>
            {eventConfig.label}
          </Tag>
        </div>
      );
    }

    if (eventProps?.tableId) {
      items.push(
        <div key="table" style={{ marginTop: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>数据表:</span>
          <span style={{ marginLeft: 8 }}>{eventProps.tableId}</span>
        </div>
      );
    }

    return items.length > 0 ? items : null;
  }, [eventType, eventProps, eventConfig]);

  return (
    <BaseNode
      node={node}
      color="blue"
      icon={<ThunderboltOutlined />}
      typeLabel="触发器"
      {...props}
    >
      {content}
    </BaseNode>
  );
};

export default EventNode;
