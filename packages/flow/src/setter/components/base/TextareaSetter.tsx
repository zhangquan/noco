/**
 * Textarea Setter Component
 */

import React from 'react';
import { Input } from 'antd';
import type { SetterProps } from '../../types';

const { TextArea } = Input;

export interface TextareaSetterProps extends SetterProps<string> {
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
}

export const TextareaSetter: React.FC<TextareaSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  props,
}) => {
  const rows = props?.rows as number ?? 4;
  const maxLength = props?.maxLength as number | undefined;
  const showCount = props?.showCount as boolean | undefined;
  const autoSize = props?.autoSize as boolean | { minRows?: number; maxRows?: number } | undefined;

  return (
    <TextArea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      showCount={showCount}
      autoSize={autoSize}
    />
  );
};

export default TextareaSetter;
