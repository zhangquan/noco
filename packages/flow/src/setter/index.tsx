/**
 * Setter Panel
 * 
 * Main component for editing node properties.
 */

import React from 'react';
import { Form, Empty, Typography, Divider } from 'antd';
import type { FlowNodeType, FlowNodeProps, SetterConfig } from '../types';
import { nodeRegistry } from '../model/register';
import { RenderSetters } from './renderSetter';
import { Section } from './components/layout/Section';

const { Title, Text } = Typography;

export interface SetterPanelProps {
  /** Selected node */
  node: FlowNodeType | null;
  /** Update node props */
  onChange: (nodeId: string, props: Partial<FlowNodeProps>) => void;
  /** Whether readonly */
  readonly?: boolean;
  /** Additional context for setters */
  context?: {
    tables?: Array<{ id: string; name: string }>;
    views?: Record<string, Array<{ id: string; name: string }>>;
    fields?: Record<string, Array<{ id: string; name: string; type: string }>>;
  };
}

export const SetterPanel: React.FC<SetterPanelProps> = ({
  node,
  onChange,
  readonly = false,
  context,
}) => {
  if (!node) {
    return (
      <div className="setter-panel setter-panel--empty">
        <Empty
          description="Select a node to edit its properties"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const registration = nodeRegistry.get(node.actionType);
  const setters = registration?.setters || getDefaultSetters(node.actionType);

  const handleChange = (name: string, value: unknown) => {
    onChange(node.id, { [name]: value } as Partial<FlowNodeProps>);
  };

  // Group setters by category
  const basicSetters = setters.filter((s) => !s.props?.category || s.props?.category === 'basic');
  const dataSetters = setters.filter((s) => s.props?.category === 'data');
  const advancedSetters = setters.filter((s) => s.props?.category === 'advanced');

  return (
    <div className="setter-panel">
      <div className="setter-panel__header">
        <Title level={5} style={{ margin: 0 }}>
          {registration?.name || node.actionType}
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {registration?.description || `Configure ${node.actionType} node`}
        </Text>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Form layout="vertical" className="setter-panel__form">
        {basicSetters.length > 0 && (
          <Section title="Basic" defaultExpanded>
            <RenderSetters
              setters={basicSetters}
              props={node.props || {}}
              onChange={handleChange}
              disabled={readonly}
            />
          </Section>
        )}

        {dataSetters.length > 0 && (
          <Section title="Data Configuration">
            <RenderSetters
              setters={dataSetters}
              props={node.props || {}}
              onChange={handleChange}
              disabled={readonly}
            />
          </Section>
        )}

        {advancedSetters.length > 0 && (
          <Section title="Advanced" defaultExpanded={false}>
            <RenderSetters
              setters={advancedSetters}
              props={node.props || {}}
              onChange={handleChange}
              disabled={readonly}
            />
          </Section>
        )}
      </Form>
    </div>
  );
};

/**
 * Get default setters for a node type
 */
function getDefaultSetters(actionType: string): SetterConfig[] {
  // Title setter is common to all nodes
  const commonSetters: SetterConfig[] = [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
      placeholder: 'Enter a description for this node',
    },
  ];

  switch (actionType) {
    case 'event':
      return [
        ...commonSetters,
        {
          name: 'eventType',
          label: 'Event Type',
          type: 'select',
          options: [
            { label: 'On Record Create', value: 'insert' },
            { label: 'On Record Update', value: 'update' },
            { label: 'On Record Delete', value: 'delete' },
            { label: 'Scheduled', value: 'timer' },
            { label: 'Manual Trigger', value: 'manual' },
            { label: 'Webhook', value: 'webhook' },
          ],
          props: { category: 'basic' },
        },
        {
          name: 'tableId',
          label: 'Table',
          type: 'select',
          placeholder: 'Select a table',
          props: { category: 'data' },
        },
        {
          name: 'viewId',
          label: 'View',
          type: 'select',
          placeholder: 'Select a view (optional)',
          props: { category: 'data' },
        },
      ];

    case 'dataList':
      return [
        ...commonSetters,
        {
          name: 'tableId',
          label: 'Table',
          type: 'select',
          required: true,
          props: { category: 'data' },
        },
        {
          name: 'viewId',
          label: 'View',
          type: 'select',
          props: { category: 'data' },
        },
        {
          name: 'limit',
          label: 'Limit',
          type: 'number',
          defaultValue: 100,
          props: { category: 'data', min: 1, max: 10000 },
        },
      ];

    case 'dataInsert':
    case 'dataUpdate':
      return [
        ...commonSetters,
        {
          name: 'tableId',
          label: 'Table',
          type: 'select',
          required: true,
          props: { category: 'data' },
        },
        {
          name: 'viewId',
          label: 'View',
          type: 'select',
          props: { category: 'data' },
        },
      ];

    case 'if':
    case 'condition':
      return [
        ...commonSetters,
        {
          name: 'expression',
          label: 'Condition',
          type: 'expression',
          placeholder: 'Enter condition expression',
          props: { category: 'basic' },
        },
      ];

    case 'var':
      return [
        ...commonSetters,
        {
          name: 'name',
          label: 'Variable Name',
          type: 'string',
          required: true,
          props: { category: 'basic' },
        },
        {
          name: 'operation',
          label: 'Operation',
          type: 'select',
          defaultValue: 'set',
          options: [
            { label: 'Set', value: 'set' },
            { label: 'Increment', value: 'increment' },
            { label: 'Decrement', value: 'decrement' },
            { label: 'Append', value: 'append' },
            { label: 'Remove', value: 'remove' },
          ],
          props: { category: 'basic' },
        },
        {
          name: 'value',
          label: 'Value',
          type: 'expression',
          props: { category: 'basic' },
        },
      ];

    case 'fn':
      return [
        ...commonSetters,
        {
          name: 'fnName',
          label: 'Function',
          type: 'select',
          props: { category: 'basic' },
        },
        {
          name: 'code',
          label: 'Custom Code',
          type: 'textarea',
          props: { category: 'advanced', rows: 6 },
        },
      ];

    case 'loop':
      return [
        ...commonSetters,
        {
          name: 'source',
          label: 'Data Source',
          type: 'expression',
          required: true,
          props: { category: 'basic' },
        },
        {
          name: 'itemVar',
          label: 'Item Variable',
          type: 'string',
          defaultValue: 'item',
          props: { category: 'basic' },
        },
        {
          name: 'maxIterations',
          label: 'Max Iterations',
          type: 'number',
          defaultValue: 1000,
          props: { category: 'advanced' },
        },
      ];

    case 'message':
      return [
        ...commonSetters,
        {
          name: 'messageType',
          label: 'Message Type',
          type: 'select',
          defaultValue: 'info',
          options: [
            { label: 'Success', value: 'success' },
            { label: 'Error', value: 'error' },
            { label: 'Warning', value: 'warning' },
            { label: 'Info', value: 'info' },
          ],
          props: { category: 'basic' },
        },
        {
          name: 'content',
          label: 'Content',
          type: 'expression',
          required: true,
          props: { category: 'basic' },
        },
        {
          name: 'duration',
          label: 'Duration (seconds)',
          type: 'number',
          defaultValue: 3,
          props: { category: 'basic' },
        },
      ];

    default:
      return commonSetters;
  }
}

// Re-exports
export * from './types';
export * from './renderSetter';
export * from './components/base';
export * from './components/layout';
export * from './components/plugins';
export { DataSetter } from './components/dataSetter';
