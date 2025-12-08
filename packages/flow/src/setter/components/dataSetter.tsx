/**
 * Data Setter Component
 * 
 * For configuring data body (field -> value mappings).
 */

import React from 'react';
import { Form, Select, Input, Button, Space, Card, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, FunctionOutlined } from '@ant-design/icons';
import type { BodySetterProps, VariableOption } from '../types';
import type { ExpressionType } from '../../types';
import { isExpression } from '../../types';

interface FieldValue {
  field: string;
  value: unknown | ExpressionType;
  isExpression: boolean;
}

export const DataSetter: React.FC<BodySetterProps> = ({
  value,
  onChange,
  disabled,
  tableId,
  fields,
  variables = [],
}) => {
  const availableFields = tableId ? fields[tableId] || [] : [];
  
  // Convert object to array for editing
  const items: FieldValue[] = value
    ? Object.entries(value).map(([field, val]) => ({
        field,
        value: val,
        isExpression: isExpression(val),
      }))
    : [];

  const handleAdd = () => {
    const newItems = [...items, { field: '', value: '', isExpression: false }];
    updateValue(newItems);
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    updateValue(newItems);
  };

  const handleFieldChange = (index: number, field: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], field };
    updateValue(newItems);
  };

  const handleValueChange = (index: number, val: unknown) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], value: val };
    updateValue(newItems);
  };

  const handleToggleExpression = (index: number) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (item.isExpression) {
      // Convert to plain value
      newItems[index] = {
        ...item,
        isExpression: false,
        value: '',
      };
    } else {
      // Convert to expression
      newItems[index] = {
        ...item,
        isExpression: true,
        value: {
          type: 'expression',
          value: String(item.value || ''),
        },
      };
    }
    
    updateValue(newItems);
  };

  const updateValue = (items: FieldValue[]) => {
    const obj: Record<string, unknown> = {};
    for (const item of items) {
      if (item.field) {
        obj[item.field] = item.value;
      }
    }
    onChange(Object.keys(obj).length > 0 ? obj : undefined);
  };

  if (!tableId) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Please select a table first"
      />
    );
  }

  return (
    <div className="data-setter">
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No fields configured"
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {items.map((item, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  value={item.field || undefined}
                  onChange={(val) => handleFieldChange(index, val)}
                  disabled={disabled}
                  placeholder="Select field"
                  style={{ width: '100%' }}
                  options={availableFields.map((f) => ({
                    value: f.id,
                    label: `${f.name} (${f.type})`,
                  }))}
                />
                
                <Space.Compact style={{ width: '100%' }}>
                  {item.isExpression ? (
                    <Input
                      value={
                        isExpression(item.value)
                          ? item.value.value
                          : String(item.value || '')
                      }
                      onChange={(e) => {
                        handleValueChange(index, {
                          type: 'expression',
                          value: e.target.value,
                        });
                      }}
                      disabled={disabled}
                      placeholder="Enter expression"
                      prefix={<FunctionOutlined />}
                    />
                  ) : (
                    <Input
                      value={String(item.value || '')}
                      onChange={(e) => handleValueChange(index, e.target.value)}
                      disabled={disabled}
                      placeholder="Enter value"
                    />
                  )}
                  <Button
                    icon={<FunctionOutlined />}
                    onClick={() => handleToggleExpression(index)}
                    type={item.isExpression ? 'primary' : 'default'}
                    title="Toggle expression mode"
                  />
                  <Button
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemove(index)}
                    danger
                    title="Remove field"
                  />
                </Space.Compact>
              </Space>
            </Card>
          ))}
        </Space>
      )}
      
      <Button
        type="dashed"
        onClick={handleAdd}
        disabled={disabled}
        icon={<PlusOutlined />}
        style={{ width: '100%', marginTop: 8 }}
      >
        Add Field
      </Button>
    </div>
  );
};

export default DataSetter;
