/**
 * Setter Panel Component
 * Main property setter panel for flow nodes
 * @module setter
 */

import React, { useCallback, useMemo } from 'react';
import { Form, Collapse, Empty, Typography, Divider } from 'antd';
import { useFlowSchemaStore } from '../states/flowSchemaStore';
import { StringSetter, NumberSetter, SelectSetter, BooleanSetter } from './components/base';
import { FlowNodeTypes, FlowEventTypes } from '../types';
import type {
  FlowNodeType,
  EventNodeProps,
  DataListNodeProps,
  DataInsertNodeProps,
  DataUpdateNodeProps,
  ConditionNodeProps,
} from '../types';
import type { SetterPanelProps } from './types';
import './styles.scss';

const { Panel } = Collapse;
const { Text } = Typography;

// ============================================================================
// Component
// ============================================================================

export const SetterPanel: React.FC<SetterPanelProps> = ({
  node: propNode,
  onChange,
  onPropsChange,
  tables = [],
  customSetters,
  disabled = false,
  className,
}) => {
  // Get node from store if not provided
  const storeNode = useFlowSchemaStore((state) => state.getSelectedNode());
  const updateNodeProps = useFlowSchemaStore((state) => state.updateNodeProps);
  
  const node = propNode ?? storeNode;

  // Handle props change
  const handlePropsChange = useCallback(
    (key: string, value: unknown) => {
      if (node) {
        const newProps = { ...(node.props || {}), [key]: value };
        if (onPropsChange) {
          onPropsChange(newProps);
        } else {
          updateNodeProps(node.id, { [key]: value });
        }
      }
    },
    [node, onPropsChange, updateNodeProps]
  );

  // Get value from props
  const getValue = useCallback(
    (key: string) => {
      return (node?.props as Record<string, unknown>)?.[key];
    },
    [node]
  );

  // Render setter field
  const renderField = useCallback(
    (label: string, key: string, setter: React.ReactNode) => (
      <Form.Item label={label} key={key}>
        {setter}
      </Form.Item>
    ),
    []
  );

  // Render node-specific setters
  const renderNodeSetters = useMemo(() => {
    if (!node) return null;

    const nodeType = node.actionType;

    switch (nodeType) {
      case FlowNodeTypes.EVENT:
        return (
          <>
            <Divider orientation="left">触发设置</Divider>
            {renderField(
              '事件类型',
              'eventType',
              <SelectSetter
                value={getValue('eventType')}
                onChange={(v) => handlePropsChange('eventType', v)}
                disabled={disabled}
                options={[
                  { label: '创建数据时', value: FlowEventTypes.INSERT },
                  { label: '更新数据时', value: FlowEventTypes.UPDATE },
                  { label: '删除数据时', value: FlowEventTypes.DELETE },
                  { label: '定时分析任务', value: FlowEventTypes.TIMER },
                  { label: 'Webhook', value: FlowEventTypes.WEBHOOK },
                  { label: '手动触发', value: FlowEventTypes.MANUAL },
                ]}
              />
            )}
            {renderField(
              '数据表',
              'tableId',
              <SelectSetter
                value={getValue('tableId')}
                onChange={(v) => handlePropsChange('tableId', v)}
                disabled={disabled}
                options={tables.map((t) => ({ label: t.title, value: t.id }))}
                placeholder="选择数据表"
              />
            )}
          </>
        );

      case FlowNodeTypes.DATALIST:
        return (
          <>
            <Divider orientation="left">数据查询</Divider>
            {renderField(
              '数据表',
              'tableId',
              <SelectSetter
                value={getValue('tableId')}
                onChange={(v) => handlePropsChange('tableId', v)}
                disabled={disabled}
                options={tables.map((t) => ({ label: t.title, value: t.id }))}
                placeholder="选择数据表"
              />
            )}
            {renderField(
              '最大记录数',
              'limit',
              <NumberSetter
                value={getValue('limit') as number}
                onChange={(v) => handlePropsChange('limit', v)}
                disabled={disabled}
                min={1}
                max={1000}
                placeholder="不限制"
              />
            )}
          </>
        );

      case FlowNodeTypes.DATAINSERT:
      case FlowNodeTypes.DATAUPDATE:
        return (
          <>
            <Divider orientation="left">
              {nodeType === FlowNodeTypes.DATAINSERT ? '插入数据' : '更新数据'}
            </Divider>
            {renderField(
              '数据表',
              'tableId',
              <SelectSetter
                value={getValue('tableId')}
                onChange={(v) => handlePropsChange('tableId', v)}
                disabled={disabled}
                options={tables.map((t) => ({ label: t.title, value: t.id }))}
                placeholder="选择数据表"
              />
            )}
            {nodeType === FlowNodeTypes.DATAUPDATE && renderField(
              '记录 ID',
              'rowId',
              <StringSetter
                value={getValue('rowId') as string}
                onChange={(v) => handlePropsChange('rowId', v)}
                disabled={disabled}
                placeholder="输入记录 ID 或绑定表达式"
              />
            )}
          </>
        );

      case FlowNodeTypes.IF:
        return (
          <>
            <Divider orientation="left">条件设置</Divider>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              点击条件分支进行编辑
            </Text>
          </>
        );

      case FlowNodeTypes.CONDITION:
        return (
          <>
            <Divider orientation="left">条件表达式</Divider>
            {renderField(
              '条件表达式',
              'expression',
              <StringSetter
                value={getValue('expression') as string}
                onChange={(v) => handlePropsChange('expression', v)}
                disabled={disabled}
                multiline
                rows={3}
                placeholder="输入条件表达式，如: {eventData.amount} > 100"
              />
            )}
          </>
        );

      case FlowNodeTypes.VAR:
        return (
          <>
            <Divider orientation="left">变量设置</Divider>
            {renderField(
              '变量名',
              'name',
              <StringSetter
                value={getValue('name') as string}
                onChange={(v) => handlePropsChange('name', v)}
                disabled={disabled}
                placeholder="输入变量名"
              />
            )}
            {renderField(
              '变量值',
              'value',
              <StringSetter
                value={String(getValue('value') || '')}
                onChange={(v) => handlePropsChange('value', v)}
                disabled={disabled}
                placeholder="输入值或表达式"
              />
            )}
          </>
        );

      case FlowNodeTypes.HTTP:
        return (
          <>
            <Divider orientation="left">HTTP 请求</Divider>
            {renderField(
              '请求方法',
              'method',
              <SelectSetter
                value={getValue('method') || 'GET'}
                onChange={(v) => handlePropsChange('method', v)}
                disabled={disabled}
                options={[
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'PATCH', value: 'PATCH' },
                  { label: 'DELETE', value: 'DELETE' },
                ]}
              />
            )}
            {renderField(
              'URL',
              'url',
              <StringSetter
                value={getValue('url') as string}
                onChange={(v) => handlePropsChange('url', v)}
                disabled={disabled}
                placeholder="输入请求 URL"
              />
            )}
          </>
        );

      case FlowNodeTypes.DELAY:
        return (
          <>
            <Divider orientation="left">延时设置</Divider>
            {renderField(
              '延时时长',
              'duration',
              <NumberSetter
                value={getValue('duration') as number}
                onChange={(v) => handlePropsChange('duration', v)}
                disabled={disabled}
                min={0}
                placeholder="输入延时时长"
              />
            )}
            {renderField(
              '时间单位',
              'unit',
              <SelectSetter
                value={getValue('unit') || 's'}
                onChange={(v) => handlePropsChange('unit', v)}
                disabled={disabled}
                options={[
                  { label: '毫秒', value: 'ms' },
                  { label: '秒', value: 's' },
                  { label: '分钟', value: 'm' },
                  { label: '小时', value: 'h' },
                ]}
              />
            )}
          </>
        );

      default:
        return null;
    }
  }, [node, getValue, handlePropsChange, renderField, disabled, tables]);

  // Empty state
  if (!node) {
    return (
      <div className={`setter-panel setter-panel--empty ${className || ''}`}>
        <Empty description="选择一个节点进行编辑" />
      </div>
    );
  }

  return (
    <div className={`setter-panel ${className || ''}`}>
      <div className="setter-panel__header">
        <Text strong>{(node.props as { title?: string })?.title || '节点属性'}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {node.actionType}
        </Text>
      </div>

      <Form layout="vertical" className="setter-panel__form">
        {/* Common fields */}
        {renderField(
          '标题',
          'title',
          <StringSetter
            value={getValue('title') as string}
            onChange={(v) => handlePropsChange('title', v)}
            disabled={disabled}
            placeholder="输入节点标题"
          />
        )}

        {/* Node-specific fields */}
        {renderNodeSetters}
      </Form>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { SetterPanelProps } from './types';
export { StringSetter, NumberSetter, SelectSetter, BooleanSetter } from './components/base';

export default SetterPanel;
