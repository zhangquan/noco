/**
 * AddNode Component
 * Add node button with dropdown menu
 * @module components/plusNodes/AddNode
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Dropdown, Button, Menu, Tooltip } from 'antd';
import {
  PlusOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  BranchesOutlined,
  ReloadOutlined,
  CodeOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useFlowSchemaStore } from '../../states/flowSchemaStore';
import { createNode } from '../../model/logic-model';
import { FlowNodeTypes } from '../../types';
import type { AddNodeMenuItem } from '../../types';
import './AddNode.scss';

// ============================================================================
// Types
// ============================================================================

export interface AddNodeProps {
  /** Parent node ID to add child to */
  parentId: string;
  /** Index to insert at (optional, defaults to end) */
  index?: number;
  /** Custom menu items */
  menuItems?: AddNodeMenuItem[];
  /** Callback after node is added */
  onAdd?: (nodeId: string, nodeType: FlowNodeTypes) => void;
  /** Button size */
  size?: 'small' | 'default' | 'large';
  /** Button type */
  buttonType?: 'default' | 'dashed' | 'link' | 'text';
  /** Show as icon only */
  iconOnly?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Placement of dropdown */
  placement?: 'bottom' | 'top' | 'left' | 'right';
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Default Menu Items
// ============================================================================

const DEFAULT_MENU_ITEMS: AddNodeMenuItem[] = [
  {
    type: 'trigger' as FlowNodeTypes,
    label: '数据操作',
    children: [
      {
        type: FlowNodeTypes.DATALIST,
        label: '查询数据',
        icon: <SearchOutlined />,
        description: '从数据表查询记录',
      },
      {
        type: FlowNodeTypes.DATAINSERT,
        label: '插入数据',
        icon: <PlusCircleOutlined />,
        description: '向数据表插入新记录',
      },
      {
        type: FlowNodeTypes.DATAUPDATE,
        label: '更新数据',
        icon: <EditOutlined />,
        description: '更新数据表中的记录',
      },
      {
        type: FlowNodeTypes.DATADELETE,
        label: '删除数据',
        icon: <DeleteOutlined />,
        description: '从数据表删除记录',
      },
    ],
  },
  {
    type: 'logic' as FlowNodeTypes,
    label: '逻辑控制',
    children: [
      {
        type: FlowNodeTypes.IF,
        label: '条件判断',
        icon: <BranchesOutlined />,
        description: '根据条件执行不同分支',
      },
      {
        type: FlowNodeTypes.LOOP,
        label: '循环',
        icon: <ReloadOutlined />,
        description: '循环执行一组操作',
      },
    ],
  },
  {
    type: 'advanced' as FlowNodeTypes,
    label: '高级',
    children: [
      {
        type: FlowNodeTypes.VAR,
        label: '设置变量',
        icon: <CodeOutlined />,
        description: '设置一个变量值',
      },
      {
        type: FlowNodeTypes.HTTP,
        label: 'HTTP 请求',
        icon: <ApiOutlined />,
        description: '发送 HTTP 请求',
      },
      {
        type: FlowNodeTypes.DELAY,
        label: '延时',
        icon: <ClockCircleOutlined />,
        description: '等待一段时间后继续',
      },
      {
        type: FlowNodeTypes.END,
        label: '结束流程',
        icon: <StopOutlined />,
        description: '结束当前流程执行',
      },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export const AddNode: React.FC<AddNodeProps> = ({
  parentId,
  index,
  menuItems = DEFAULT_MENU_ITEMS,
  onAdd,
  size = 'small',
  buttonType = 'dashed',
  iconOnly = true,
  disabled = false,
  tooltip = '添加节点',
  placement = 'bottom',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const addNode = useFlowSchemaStore((state) => state.addNode);
  const mode = useFlowSchemaStore((state) => state.mode);

  const isReadOnly = mode === 'readonly' || mode === 'preview';

  // Handle menu item click
  const handleMenuClick = useCallback(
    (nodeType: FlowNodeTypes) => {
      const newNode = createNode(nodeType, {
        title: getDefaultTitle(nodeType),
      });
      const newId = addNode(parentId, newNode, index);
      setOpen(false);
      onAdd?.(newId, nodeType);
    },
    [parentId, index, addNode, onAdd]
  );

  // Build menu
  const menu = useMemo(() => {
    const buildMenuItems = (items: AddNodeMenuItem[]): React.ReactNode[] => {
      return items.map((item, idx) => {
        if (item.children && item.children.length > 0) {
          return (
            <Menu.SubMenu
              key={`${item.type}-${idx}`}
              title={item.label}
              icon={item.icon}
            >
              {buildMenuItems(item.children)}
            </Menu.SubMenu>
          );
        }

        return (
          <Menu.Item
            key={item.type}
            icon={item.icon}
            disabled={item.disabled}
            onClick={() => handleMenuClick(item.type)}
          >
            <div className="add-node-menu-item">
              <span className="add-node-menu-item__label">{item.label}</span>
              {item.description && (
                <span className="add-node-menu-item__desc">{item.description}</span>
              )}
            </div>
          </Menu.Item>
        );
      });
    };

    return <Menu>{buildMenuItems(menuItems)}</Menu>;
  }, [menuItems, handleMenuClick]);

  if (isReadOnly || disabled) {
    return null;
  }

  const button = (
    <Button
      type={buttonType}
      size={size}
      icon={<PlusOutlined />}
      className={`add-node-btn ${className || ''}`}
    >
      {!iconOnly && '添加节点'}
    </Button>
  );

  return (
    <Dropdown
      overlay={menu}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement={placement}
    >
      {tooltip ? (
        <Tooltip title={tooltip}>{button}</Tooltip>
      ) : (
        button
      )}
    </Dropdown>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function getDefaultTitle(nodeType: FlowNodeTypes): string {
  const titles: Record<string, string> = {
    [FlowNodeTypes.EVENT]: '事件触发',
    [FlowNodeTypes.DATALIST]: '查询数据',
    [FlowNodeTypes.DATAINSERT]: '插入数据',
    [FlowNodeTypes.DATAUPDATE]: '更新数据',
    [FlowNodeTypes.DATADELETE]: '删除数据',
    [FlowNodeTypes.IF]: '条件判断',
    [FlowNodeTypes.CONDITION]: '条件分支',
    [FlowNodeTypes.LOOP]: '循环',
    [FlowNodeTypes.VAR]: '设置变量',
    [FlowNodeTypes.FN]: '函数',
    [FlowNodeTypes.HTTP]: 'HTTP 请求',
    [FlowNodeTypes.DELAY]: '延时',
    [FlowNodeTypes.END]: '结束',
  };
  return titles[nodeType] || '新节点';
}

export default AddNode;
