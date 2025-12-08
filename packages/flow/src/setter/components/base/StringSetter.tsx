/**
 * String Setter Component
 */

import React from 'react';
import { Input } from 'antd';
import type { SetterProps } from '../../types';

export interface StringSetterProps extends SetterProps<string> {
  maxLength?: number;
  showCount?: boolean;
}

export const StringSetter: React.FC<StringSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  props,
}) => {
  const maxLength = props?.maxLength as number | undefined;
  const showCount = props?.showCount as boolean | undefined;

  return (
    <Input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      showCount={showCount}
    />
  );
};

export default StringSetter;
