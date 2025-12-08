/**
 * BooleanSetter Component
 * Setter for boolean values
 * @module setter/components/base/BooleanSetter
 */

import React, { useCallback } from 'react';
import { Switch } from 'antd';
import type { BooleanSetterProps } from '../../types';

export const BooleanSetter: React.FC<BooleanSetterProps> = ({
  value,
  onChange,
  disabled,
  checkedLabel,
  uncheckedLabel,
}) => {
  const handleChange = useCallback(
    (checked: boolean) => {
      onChange(checked);
    },
    [onChange]
  );

  return (
    <Switch
      checked={!!value}
      onChange={handleChange}
      disabled={disabled}
      checkedChildren={checkedLabel}
      unCheckedChildren={uncheckedLabel}
    />
  );
};

export default BooleanSetter;
