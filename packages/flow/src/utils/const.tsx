/**
 * Constants
 * 
 * Common constants used throughout the FlowSDK.
 */

import React from 'react';
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
import { FlowNodeTypes, FlowEventTypes, FlowVarTypes, FilterOperators } from '../types';

/**
 * Node type configurations
 */
export const NODE_TYPE_CONFIG = {
  [FlowNodeTypes.EVENT]: {
    name: 'Event Trigger',
    icon: <ThunderboltOutlined />,
    color: '#722ed1',
    category: 'trigger',
  },
  [FlowNodeTypes.DATALIST]: {
    name: 'Query Data',
    icon: <SearchOutlined />,
    color: '#13c2c2',
    category: 'data',
  },
  [FlowNodeTypes.DATAINSERT]: {
    name: 'Insert Data',
    icon: <PlusSquareOutlined />,
    color: '#52c41a',
    category: 'data',
  },
  [FlowNodeTypes.DATAUPDATE]: {
    name: 'Update Data',
    icon: <EditOutlined />,
    color: '#1890ff',
    category: 'data',
  },
  [FlowNodeTypes.DATADELETE]: {
    name: 'Delete Data',
    icon: <DeleteOutlined />,
    color: '#ff4d4f',
    category: 'data',
  },
  [FlowNodeTypes.IF]: {
    name: 'Condition',
    icon: <BranchesOutlined />,
    color: '#faad14',
    category: 'logic',
  },
  [FlowNodeTypes.CONDITION]: {
    name: 'Branch',
    icon: <QuestionCircleOutlined />,
    color: '#52c41a',
    category: 'logic',
  },
  [FlowNodeTypes.VAR]: {
    name: 'Variable',
    icon: <NodeIndexOutlined />,
    color: '#eb2f96',
    category: 'utility',
  },
  [FlowNodeTypes.FN]: {
    name: 'Function',
    icon: <FunctionOutlined />,
    color: '#722ed1',
    category: 'utility',
  },
  [FlowNodeTypes.LOOP]: {
    name: 'Loop',
    icon: <ReloadOutlined />,
    color: '#fa541c',
    category: 'logic',
  },
  [FlowNodeTypes.MESSAGE]: {
    name: 'Message',
    icon: <MessageOutlined />,
    color: '#1890ff',
    category: 'utility',
  },
};

/**
 * Event type configurations
 */
export const EVENT_TYPE_CONFIG = {
  [FlowEventTypes.INSERT]: {
    name: 'On Record Create',
    description: 'Triggered when a new record is created',
  },
  [FlowEventTypes.UPDATE]: {
    name: 'On Record Update',
    description: 'Triggered when a record is updated',
  },
  [FlowEventTypes.DELETE]: {
    name: 'On Record Delete',
    description: 'Triggered when a record is deleted',
  },
  [FlowEventTypes.TIMER]: {
    name: 'Scheduled',
    description: 'Triggered on a schedule',
  },
  [FlowEventTypes.MANUAL]: {
    name: 'Manual Trigger',
    description: 'Triggered manually',
  },
  [FlowEventTypes.WEBHOOK]: {
    name: 'Webhook',
    description: 'Triggered by HTTP request',
  },
};

/**
 * Variable type configurations
 */
export const VAR_TYPE_CONFIG = {
  [FlowVarTypes.STRING]: { name: 'String', defaultValue: '' },
  [FlowVarTypes.NUMBER]: { name: 'Number', defaultValue: 0 },
  [FlowVarTypes.BOOLEAN]: { name: 'Boolean', defaultValue: false },
  [FlowVarTypes.OBJECT]: { name: 'Object', defaultValue: {} },
  [FlowVarTypes.ARRAY]: { name: 'Array', defaultValue: [] },
  [FlowVarTypes.DATE]: { name: 'Date', defaultValue: null },
  [FlowVarTypes.NULL]: { name: 'Null', defaultValue: null },
};

/**
 * Filter operator configurations
 */
export const FILTER_OPERATOR_CONFIG = {
  [FilterOperators.EQ]: { name: 'Equals', symbol: '=' },
  [FilterOperators.NEQ]: { name: 'Not Equals', symbol: '≠' },
  [FilterOperators.GT]: { name: 'Greater Than', symbol: '>' },
  [FilterOperators.GTE]: { name: 'Greater Than or Equal', symbol: '≥' },
  [FilterOperators.LT]: { name: 'Less Than', symbol: '<' },
  [FilterOperators.LTE]: { name: 'Less Than or Equal', symbol: '≤' },
  [FilterOperators.LIKE]: { name: 'Contains', symbol: '∋' },
  [FilterOperators.NLIKE]: { name: 'Does Not Contain', symbol: '∌' },
  [FilterOperators.IS_NULL]: { name: 'Is Empty', symbol: '∅' },
  [FilterOperators.IS_NOT_NULL]: { name: 'Is Not Empty', symbol: '≠∅' },
  [FilterOperators.IN]: { name: 'In', symbol: '∈' },
  [FilterOperators.NOT_IN]: { name: 'Not In', symbol: '∉' },
  [FilterOperators.BETWEEN]: { name: 'Between', symbol: '⟨⟩' },
};

/**
 * Add node menu items
 */
export const ADD_NODE_MENU = [
  {
    key: 'data',
    label: 'Data Operations',
    children: [
      { key: FlowNodeTypes.DATALIST, ...NODE_TYPE_CONFIG[FlowNodeTypes.DATALIST] },
      { key: FlowNodeTypes.DATAINSERT, ...NODE_TYPE_CONFIG[FlowNodeTypes.DATAINSERT] },
      { key: FlowNodeTypes.DATAUPDATE, ...NODE_TYPE_CONFIG[FlowNodeTypes.DATAUPDATE] },
      { key: FlowNodeTypes.DATADELETE, ...NODE_TYPE_CONFIG[FlowNodeTypes.DATADELETE] },
    ],
  },
  {
    key: 'logic',
    label: 'Logic',
    children: [
      { key: FlowNodeTypes.IF, ...NODE_TYPE_CONFIG[FlowNodeTypes.IF] },
      { key: FlowNodeTypes.LOOP, ...NODE_TYPE_CONFIG[FlowNodeTypes.LOOP] },
    ],
  },
  {
    key: 'utility',
    label: 'Utility',
    children: [
      { key: FlowNodeTypes.VAR, ...NODE_TYPE_CONFIG[FlowNodeTypes.VAR] },
      { key: FlowNodeTypes.FN, ...NODE_TYPE_CONFIG[FlowNodeTypes.FN] },
      { key: FlowNodeTypes.MESSAGE, ...NODE_TYPE_CONFIG[FlowNodeTypes.MESSAGE] },
    ],
  },
];

/**
 * Default zoom levels
 */
export const ZOOM_LEVELS = {
  MIN: 0.25,
  MAX: 2,
  DEFAULT: 1,
  STEP: 0.1,
};

/**
 * Default flow execution settings
 */
export const EXECUTION_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  MAX_TIMEOUT: 600000,
  MAX_ITERATIONS: 10000,
  MAX_RECURSION_DEPTH: 100,
};
