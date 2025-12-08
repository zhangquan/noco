/**
 * NumberSetter Component
 * Setter for number values
 * @module setter/components/base/NumberSetter
 */

import React, { useCallback } from 'react';
import { InputNumber } from 'antd';
import type { NumberSetterProps } from '../../types';

export const NumberSetter: React.FC<NumberSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  min,
  max,
  step,
  precision,
  addonAfter,
}) => {
  const handleChange = useCallback(
    (val: number | null) => {
      onChange(val ?? 0);
    },
    [onChange]
  );

  return (
    <InputNumber
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      precision={precision}
      addonAfter={addonAfter}
      style={{ width: '100%' }}
    />
  );
};

export default NumberSetter;
