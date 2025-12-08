/**
 * Boolean Setter Component
 */

import React from 'react';
import { Switch } from 'antd';
import type { SetterProps } from '../../types';

export interface BooleanSetterProps extends SetterProps<boolean> {
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
}

export const BooleanSetter: React.FC<BooleanSetterProps> = ({
  value,
  onChange,
  disabled,
  props,
}) => {
  const checkedChildren = props?.checkedChildren as React.ReactNode;
  const unCheckedChildren = props?.unCheckedChildren as React.ReactNode;

  return (
    <Switch
      checked={value || false}
      onChange={(checked) => onChange(checked)}
      disabled={disabled}
      checkedChildren={checkedChildren}
      unCheckedChildren={unCheckedChildren}
    />
  );
};

export default BooleanSetter;
