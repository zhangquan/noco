/**
 * Data Operation Nodes
 * Nodes for data CRUD operations
 * @module components/nodes/DataNodes
 */

import React, { useMemo } from 'react';
import {
  SearchOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import { BaseNode, type BaseNodeProps } from './BaseNode';
import type {
  FlowNodeType,
  DataListNodeProps,
  DataInsertNodeProps,
  DataUpdateNodeProps,
  DataDeleteNodeProps,
  ExpressionType,
} from '../../types';
import { isExpression } from '../../types';

// ============================================================================
// Shared Components
// ============================================================================

interface TableInfoProps {
  tableId?: string;
  viewId?: string;
}

const TableInfo: React.FC<TableInfoProps> = ({ tableId, viewId }) => {
  if (!tableId) {
    return (
      <div style={{ color: 'rgba(0,0,0,0.45)' }}>
        <TableOutlined style={{ marginRight: 4 }} />
        未选择数据表
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <TableOutlined style={{ color: 'rgba(0,0,0,0.45)' }} />
      <span>{tableId}</span>
      {viewId && (
        <Tag color="blue" style={{ margin: 0 }}>
          {viewId}
        </Tag>
      )}
    </div>
  );
};

// ============================================================================
// DataListNode - Query Data
// ============================================================================

export interface DataListNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
}

export const DataListNode: React.FC<DataListNodeComponentProps> = ({
  node,
  ...props
}) => {
  const dataProps = node.props as DataListNodeProps | undefined;

  const content = useMemo(() => {
    const items: React.ReactNode[] = [];

    items.push(
      <TableInfo key="table" tableId={dataProps?.tableId} viewId={dataProps?.viewId} />
    );

    if (dataProps?.filters && dataProps.filters.length > 0) {
      items.push(
        <div key="filters" style={{ marginTop: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>筛选条件:</span>
          <span style={{ marginLeft: 4 }}>{dataProps.filters.length} 个</span>
        </div>
      );
    }

    if (dataProps?.limit) {
      const limitValue = isExpression(dataProps.limit)
        ? (dataProps.limit as ExpressionType).label || (dataProps.limit as ExpressionType).value
        : dataProps.limit;
      items.push(
        <div key="limit" style={{ marginTop: 4 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>最大记录数:</span>
          <span style={{ marginLeft: 4 }}>{limitValue}</span>
        </div>
      );
    }

    return items;
  }, [dataProps]);

  return (
    <BaseNode
      node={node}
      color="blue"
      icon={<SearchOutlined />}
      typeLabel="查询"
      {...props}
    >
      {content}
    </BaseNode>
  );
};

// ============================================================================
// DataInsertNode - Insert Data
// ============================================================================

export interface DataInsertNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
}

export const DataInsertNode: React.FC<DataInsertNodeComponentProps> = ({
  node,
  ...props
}) => {
  const dataProps = node.props as DataInsertNodeProps | undefined;

  const content = useMemo(() => {
    const items: React.ReactNode[] = [];

    items.push(
      <TableInfo key="table" tableId={dataProps?.tableId} viewId={dataProps?.viewId} />
    );

    if (dataProps?.body) {
      const fieldCount = Object.keys(dataProps.body).length;
      items.push(
        <div key="fields" style={{ marginTop: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>设置字段:</span>
          <span style={{ marginLeft: 4 }}>{fieldCount} 个</span>
        </div>
      );
    }

    return items;
  }, [dataProps]);

  return (
    <BaseNode
      node={node}
      color="green"
      icon={<PlusCircleOutlined />}
      typeLabel="插入"
      {...props}
    >
      {content}
    </BaseNode>
  );
};

// ============================================================================
// DataUpdateNode - Update Data
// ============================================================================

export interface DataUpdateNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
}

export const DataUpdateNode: React.FC<DataUpdateNodeComponentProps> = ({
  node,
  ...props
}) => {
  const dataProps = node.props as DataUpdateNodeProps | undefined;

  const content = useMemo(() => {
    const items: React.ReactNode[] = [];

    items.push(
      <TableInfo key="table" tableId={dataProps?.tableId} viewId={dataProps?.viewId} />
    );

    if (dataProps?.rowId) {
      const rowIdDisplay = isExpression(dataProps.rowId)
        ? (dataProps.rowId as ExpressionType).label || (dataProps.rowId as ExpressionType).value
        : dataProps.rowId;
      items.push(
        <div key="rowId" style={{ marginTop: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>记录 ID:</span>
          <code
            style={{
              marginLeft: 4,
              padding: '1px 4px',
              background: '#f5f5f5',
              borderRadius: 2,
              fontSize: 12,
            }}
          >
            {rowIdDisplay}
          </code>
        </div>
      );
    }

    if (dataProps?.body) {
      const fieldCount = Object.keys(dataProps.body).length;
      items.push(
        <div key="fields" style={{ marginTop: 4 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>更新字段:</span>
          <span style={{ marginLeft: 4 }}>{fieldCount} 个</span>
        </div>
      );
    }

    return items;
  }, [dataProps]);

  return (
    <BaseNode
      node={node}
      color="orange"
      icon={<EditOutlined />}
      typeLabel="更新"
      {...props}
    >
      {content}
    </BaseNode>
  );
};

// ============================================================================
// DataDeleteNode - Delete Data
// ============================================================================

export interface DataDeleteNodeComponentProps extends Omit<BaseNodeProps, 'node' | 'color' | 'icon'> {
  node: FlowNodeType;
}

export const DataDeleteNode: React.FC<DataDeleteNodeComponentProps> = ({
  node,
  ...props
}) => {
  const dataProps = node.props as DataDeleteNodeProps | undefined;

  const content = useMemo(() => {
    const items: React.ReactNode[] = [];

    items.push(
      <TableInfo key="table" tableId={dataProps?.tableId} viewId={dataProps?.viewId} />
    );

    if (dataProps?.rowId) {
      const rowIdDisplay = isExpression(dataProps.rowId)
        ? (dataProps.rowId as ExpressionType).label || (dataProps.rowId as ExpressionType).value
        : dataProps.rowId;
      items.push(
        <div key="rowId" style={{ marginTop: 8 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>记录 ID:</span>
          <code
            style={{
              marginLeft: 4,
              padding: '1px 4px',
              background: '#f5f5f5',
              borderRadius: 2,
              fontSize: 12,
            }}
          >
            {rowIdDisplay}
          </code>
        </div>
      );
    }

    return items;
  }, [dataProps]);

  return (
    <BaseNode
      node={node}
      color="red"
      icon={<DeleteOutlined />}
      typeLabel="删除"
      {...props}
    >
      {content}
    </BaseNode>
  );
};

export default {
  DataListNode,
  DataInsertNode,
  DataUpdateNode,
  DataDeleteNode,
};
