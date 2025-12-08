/**
 * Add Node Component
 * 
 * Dropdown menu for adding new nodes.
 */

import React from 'react';
import { Dropdown, Button, Typography, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  PlusSquareOutlined,
  EditOutlined,
  DeleteOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  FunctionOutlined,
  ReloadOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { FlowNodeTypes } from '../../types';

const { Text } = Typography;

export interface AddNodeProps {
  /** Called when a node type is selected */
  onSelect: (type: FlowNodeTypes) => void;
  /** Whether disabled */
  disabled?: boolean;
  /** Button style */
  buttonStyle?: 'icon' | 'text' | 'default';
  /** Placement */
  placement?: 'bottomLeft' | 'bottomRight' | 'bottom';
}

interface NodeOption {
  type: FlowNodeTypes;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const nodeOptions: NodeOption[] = [
  {
    type: FlowNodeTypes.DATALIST,
    label: 'Query Data',
    icon: <SearchOutlined />,
    description: 'Fetch records from a table',
  },
  {
    type: FlowNodeTypes.DATAINSERT,
    label: 'Insert Data',
    icon: <PlusSquareOutlined />,
    description: 'Create a new record',
  },
  {
    type: FlowNodeTypes.DATAUPDATE,
    label: 'Update Data',
    icon: <EditOutlined />,
    description: 'Modify existing records',
  },
  {
    type: FlowNodeTypes.DATADELETE,
    label: 'Delete Data',
    icon: <DeleteOutlined />,
    description: 'Remove records',
  },
  {
    type: FlowNodeTypes.IF,
    label: 'Condition',
    icon: <BranchesOutlined />,
    description: 'Branch based on conditions',
  },
  {
    type: FlowNodeTypes.VAR,
    label: 'Variable',
    icon: <NodeIndexOutlined />,
    description: 'Set or modify a variable',
  },
  {
    type: FlowNodeTypes.FN,
    label: 'Function',
    icon: <FunctionOutlined />,
    description: 'Execute a function',
  },
  {
    type: FlowNodeTypes.LOOP,
    label: 'Loop',
    icon: <ReloadOutlined />,
    description: 'Iterate over data',
  },
  {
    type: FlowNodeTypes.MESSAGE,
    label: 'Message',
    icon: <MessageOutlined />,
    description: 'Show a notification',
  },
];

export const AddNode: React.FC<AddNodeProps> = ({
  onSelect,
  disabled = false,
  buttonStyle = 'default',
  placement = 'bottomLeft',
}) => {
  const menuItems: MenuProps['items'] = [
    {
      key: 'data',
      type: 'group',
      label: 'Data Operations',
      children: nodeOptions
        .filter((opt) => 
          [FlowNodeTypes.DATALIST, FlowNodeTypes.DATAINSERT, 
           FlowNodeTypes.DATAUPDATE, FlowNodeTypes.DATADELETE].includes(opt.type)
        )
        .map((opt) => ({
          key: opt.type,
          icon: opt.icon,
          label: (
            <Space direction="vertical" size={0}>
              <Text>{opt.label}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {opt.description}
              </Text>
            </Space>
          ),
          onClick: () => onSelect(opt.type),
        })),
    },
    {
      key: 'logic',
      type: 'group',
      label: 'Logic',
      children: nodeOptions
        .filter((opt) => 
          [FlowNodeTypes.IF, FlowNodeTypes.LOOP].includes(opt.type)
        )
        .map((opt) => ({
          key: opt.type,
          icon: opt.icon,
          label: (
            <Space direction="vertical" size={0}>
              <Text>{opt.label}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {opt.description}
              </Text>
            </Space>
          ),
          onClick: () => onSelect(opt.type),
        })),
    },
    {
      key: 'utility',
      type: 'group',
      label: 'Utility',
      children: nodeOptions
        .filter((opt) => 
          [FlowNodeTypes.VAR, FlowNodeTypes.FN, FlowNodeTypes.MESSAGE].includes(opt.type)
        )
        .map((opt) => ({
          key: opt.type,
          icon: opt.icon,
          label: (
            <Space direction="vertical" size={0}>
              <Text>{opt.label}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {opt.description}
              </Text>
            </Space>
          ),
          onClick: () => onSelect(opt.type),
        })),
    },
  ];

  const renderButton = () => {
    switch (buttonStyle) {
      case 'icon':
        return (
          <Button
            type="primary"
            shape="circle"
            icon={<PlusOutlined />}
            disabled={disabled}
          />
        );
      case 'text':
        return (
          <Button type="link" icon={<PlusOutlined />} disabled={disabled}>
            Add Node
          </Button>
        );
      default:
        return (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            disabled={disabled}
            style={{ width: '100%' }}
          >
            Add Node
          </Button>
        );
    }
  };

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement={placement}
      disabled={disabled}
    >
      {renderButton()}
    </Dropdown>
  );
};

export default AddNode;
