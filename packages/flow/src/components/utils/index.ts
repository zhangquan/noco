/**
 * Component Utilities
 */

import type { FlowNodeTypes } from '../../types';
import {
  ThunderboltOutlined,
  SearchOutlined,
  PlusSquareOutlined,
  EditOutlined,
  DeleteOutlined,
  BranchesOutlined,
  QuestionCircleOutlined,
  NodeIndexOutlined,
  FunctionOutlined,
  ReloadOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import React from 'react';

/**
 * Get icon for a node type
 */
export function getNodeIcon(type: FlowNodeTypes): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    event: React.createElement(ThunderboltOutlined),
    dataList: React.createElement(SearchOutlined),
    dataInsert: React.createElement(PlusSquareOutlined),
    dataUpdate: React.createElement(EditOutlined),
    dataDelete: React.createElement(DeleteOutlined),
    if: React.createElement(BranchesOutlined),
    condition: React.createElement(QuestionCircleOutlined),
    var: React.createElement(NodeIndexOutlined),
    fn: React.createElement(FunctionOutlined),
    loop: React.createElement(ReloadOutlined),
    message: React.createElement(MessageOutlined),
  };

  return icons[type] || icons.event;
}

/**
 * Get color for a node type
 */
export function getNodeColor(type: FlowNodeTypes): string {
  const colors: Record<string, string> = {
    event: '#722ed1',
    dataList: '#13c2c2',
    dataInsert: '#52c41a',
    dataUpdate: '#1890ff',
    dataDelete: '#ff4d4f',
    if: '#faad14',
    condition: '#52c41a',
    var: '#eb2f96',
    fn: '#722ed1',
    loop: '#fa541c',
    message: '#1890ff',
  };

  return colors[type] || '#1890ff';
}

/**
 * Get display name for a node type
 */
export function getNodeName(type: FlowNodeTypes): string {
  const names: Record<string, string> = {
    event: 'Event Trigger',
    dataList: 'Query Data',
    dataInsert: 'Insert Data',
    dataUpdate: 'Update Data',
    dataDelete: 'Delete Data',
    if: 'Condition',
    condition: 'Branch',
    var: 'Variable',
    fn: 'Function',
    loop: 'Loop',
    message: 'Message',
  };

  return names[type] || type;
}
