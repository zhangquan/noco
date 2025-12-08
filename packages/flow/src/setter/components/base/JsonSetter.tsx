/**
 * JSON Setter Component
 */

import React, { useState, useEffect } from 'react';
import { Input, Typography } from 'antd';
import type { SetterProps } from '../../types';

const { TextArea } = Input;
const { Text } = Typography;

export interface JsonSetterProps extends SetterProps<unknown> {
  rows?: number;
}

export const JsonSetter: React.FC<JsonSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  props,
}) => {
  const rows = props?.rows as number ?? 6;
  
  const [text, setText] = useState<string>(() => {
    try {
      return value ? JSON.stringify(value, null, 2) : '';
    } catch {
      return '';
    }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setText(value ? JSON.stringify(value, null, 2) : '');
      setError(null);
    } catch {
      // Keep current text if serialization fails
    }
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    
    if (!newText.trim()) {
      setError(null);
      onChange(undefined);
      return;
    }

    try {
      const parsed = JSON.parse(newText);
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError('Invalid JSON');
    }
  };

  return (
    <div>
      <TextArea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || '{\n  "key": "value"\n}'}
        rows={rows}
        style={{ fontFamily: 'monospace' }}
      />
      {error && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {error}
        </Text>
      )}
    </div>
  );
};

export default JsonSetter;
