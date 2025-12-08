/**
 * Number Setter Component
 */

import React from 'react';
import { InputNumber } from 'antd';
import type { SetterProps } from '../../types';

export interface NumberSetterProps extends SetterProps<number> {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export const NumberSetter: React.FC<NumberSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  props,
}) => {
  const min = props?.min as number | undefined;
  const max = props?.max as number | undefined;
  const step = props?.step as number | undefined;
  const precision = props?.precision as number | undefined;

  return (
    <InputNumber
      value={value}
      onChange={(val) => onChange(val ?? undefined)}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      precision={precision}
      style={{ width: '100%' }}
    />
  );
};

export default NumberSetter;
