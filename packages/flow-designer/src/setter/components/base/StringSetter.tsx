/**
 * StringSetter Component
 * Setter for string values
 * @module setter/components/base/StringSetter
 */

import React, { useCallback } from 'react';
import { Input } from 'antd';
import type { StringSetterProps } from '../../types';

const { TextArea } = Input;

export const StringSetter: React.FC<StringSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  maxLength,
  showCount,
  multiline,
  rows = 3,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  if (multiline) {
    return (
      <TextArea
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        showCount={showCount}
        rows={rows}
      />
    );
  }

  return (
    <Input
      value={value || ''}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      showCount={showCount}
    />
  );
};

export default StringSetter;
