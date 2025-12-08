/**
 * Expression Binder Plugin
 * 
 * Adds expression binding capability to any setter.
 */

import React, { useState } from 'react';
import { Popover, Button, Tree, Input, Tabs, Space, Typography } from 'antd';
import { FunctionOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import type { ExpressionSetterProps, VariableOption } from '../../types';
import type { ExpressionType } from '../../../types';
import { isExpression } from '../../../types';

const { Text } = Typography;

export interface ExpressionBinderProps<T> extends ExpressionSetterProps<T> {
  /** Render the underlying setter */
  children: (props: {
    value: T | undefined;
    onChange: (value: T) => void;
    disabled?: boolean;
  }) => React.ReactNode;
}

export function ExpressionBinder<T>({
  value,
  onChange,
  disabled,
  allowExpression = true,
  variables = [],
  children,
}: ExpressionBinderProps<T>) {
  const [isExpressionMode, setIsExpressionMode] = useState(() => isExpression(value));
  const [expressionText, setExpressionText] = useState(() => 
    isExpression(value) ? value.value : ''
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleToggleMode = () => {
    if (isExpressionMode) {
      // Switch to value mode
      setIsExpressionMode(false);
      onChange(undefined as T | ExpressionType | undefined);
    } else {
      // Switch to expression mode
      setIsExpressionMode(true);
      if (expressionText) {
        onChange({
          type: 'expression',
          value: expressionText,
        } as T | ExpressionType);
      }
    }
  };

  const handleExpressionChange = (text: string) => {
    setExpressionText(text);
    onChange({
      type: 'expression',
      value: text,
    } as T | ExpressionType);
  };

  const handleSelectVariable = (path: string) => {
    const newText = `{${path}}`;
    setExpressionText(newText);
    onChange({
      type: 'expression',
      value: newText,
    } as T | ExpressionType);
    setPopoverOpen(false);
  };

  // Convert variables to tree data
  const treeData = variablesToTreeData(variables);

  const variableSelector = (
    <div style={{ width: 300, maxHeight: 400, overflow: 'auto' }}>
      <Tabs
        size="small"
        items={[
          {
            key: 'variables',
            label: 'Variables',
            children: (
              <Tree
                treeData={treeData}
                onSelect={(keys) => {
                  if (keys.length > 0) {
                    handleSelectVariable(keys[0] as string);
                  }
                }}
                showIcon={false}
                defaultExpandAll
              />
            ),
          },
          {
            key: 'custom',
            label: 'Custom',
            children: (
              <div>
                <Input.TextArea
                  value={expressionText}
                  onChange={(e) => handleExpressionChange(e.target.value)}
                  placeholder="Enter expression, e.g. {eventData.id}"
                  rows={4}
                />
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  Use {'{'}variable.path{'}'} syntax
                </Text>
              </div>
            ),
          },
        ]}
      />
    </div>
  );

  if (!allowExpression) {
    // No expression support, render children directly
    return (
      <>
        {children({
          value: value as T | undefined,
          onChange: (v) => onChange(v as T | ExpressionType | undefined),
          disabled,
        })}
      </>
    );
  }

  if (isExpressionMode) {
    // Expression mode
    return (
      <Space.Compact style={{ width: '100%' }}>
        <Popover
          content={variableSelector}
          title="Select Variable"
          trigger="click"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          placement="bottomLeft"
        >
          <Input
            value={expressionText}
            onChange={(e) => handleExpressionChange(e.target.value)}
            placeholder="Enter expression"
            disabled={disabled}
            prefix={<FunctionOutlined />}
            style={{ flex: 1 }}
          />
        </Popover>
        <Button
          icon={<EditOutlined />}
          onClick={handleToggleMode}
          title="Switch to value mode"
        />
      </Space.Compact>
    );
  }

  // Value mode
  return (
    <Space.Compact style={{ width: '100%' }}>
      <div style={{ flex: 1 }}>
        {children({
          value: value as T | undefined,
          onChange: (v) => onChange(v as T | ExpressionType | undefined),
          disabled,
        })}
      </div>
      <Button
        icon={<FunctionOutlined />}
        onClick={handleToggleMode}
        title="Switch to expression mode"
      />
    </Space.Compact>
  );
}

/**
 * Convert variable options to Ant Design tree data
 */
function variablesToTreeData(
  variables: VariableOption[],
  parentPath = ''
): Array<{
  key: string;
  title: string;
  children?: Array<{ key: string; title: string }>;
}> {
  return variables.map((v) => {
    const path = parentPath ? `${parentPath}.${v.path}` : v.path;
    return {
      key: path,
      title: `${v.label} (${v.path})`,
      children: v.children ? variablesToTreeData(v.children, path) : undefined,
    };
  });
}

export default ExpressionBinder;
