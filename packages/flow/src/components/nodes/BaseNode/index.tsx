/**
 * Base Node Component
 * 
 * Foundation component for all flow nodes.
 */

import React from 'react';
import { Card, Typography, Badge, Dropdown } from 'antd';
import {
  MoreOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { FlowNodeType } from '../../../types';
import './style.css';

const { Text } = Typography;

export interface BaseNodeProps {
  /** Node data */
  node: FlowNodeType;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Node color/theme */
  color?: string;
  /** Whether selected */
  selected?: boolean;
  /** Whether readonly */
  readonly?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Delete handler */
  onDelete?: () => void;
  /** Duplicate handler */
  onDuplicate?: () => void;
  /** Edit handler */
  onEdit?: () => void;
  /** Additional content */
  children?: React.ReactNode;
  /** Badge count */
  badge?: number;
  /** Status indicator */
  status?: 'success' | 'error' | 'warning' | 'processing' | 'default';
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  node,
  icon,
  color = '#1890ff',
  selected = false,
  readonly = false,
  onClick,
  onDelete,
  onDuplicate,
  onEdit,
  children,
  badge,
  status,
}) => {
  const title = node.props?.title || node.actionType;

  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: onEdit,
    },
    {
      key: 'duplicate',
      icon: <CopyOutlined />,
      label: 'Duplicate',
      onClick: onDuplicate,
      disabled: readonly,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: onDelete,
      disabled: readonly,
    },
  ];

  const cardContent = (
    <Card
      className={`flow-node ${selected ? 'flow-node--selected' : ''}`}
      style={{ borderLeftColor: color }}
      size="small"
      onClick={onClick}
    >
      <div className="flow-node__header">
        <div className="flow-node__icon" style={{ color }}>
          {icon}
        </div>
        <div className="flow-node__title">
          <Text strong ellipsis style={{ maxWidth: 150 }}>
            {String(title)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {node.actionType}
          </Text>
        </div>
        {!readonly && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <MoreOutlined
              className="flow-node__menu"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>
      
      {children && <div className="flow-node__content">{children}</div>}
    </Card>
  );

  if (badge !== undefined || status) {
    return (
      <Badge
        count={badge}
        status={status}
        offset={[-5, 5]}
      >
        {cardContent}
      </Badge>
    );
  }

  return cardContent;
};

export default BaseNode;
