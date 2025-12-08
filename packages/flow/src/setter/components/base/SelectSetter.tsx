/**
 * SelectSetter Component
 * Setter for select values
 * @module setter/components/base/SelectSetter
 */

import React, { useCallback, useMemo } from 'react';
import { Select } from 'antd';
import type { SelectSetterProps } from '../../types';

export const SelectSetter: React.FC<SelectSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  options,
  allowClear = true,
  showSearch,
  multiple,
}) => {
  const handleChange = useCallback(
    (val: unknown) => {
      onChange(val);
    },
    [onChange]
  );

  const selectOptions = useMemo(() => {
    return options.map((opt) => ({
      label: opt.label,
      value: opt.value,
      disabled: opt.disabled,
    }));
  }, [options]);

  return (
    <Select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder || '请选择'}
      allowClear={allowClear}
      showSearch={showSearch}
      mode={multiple ? 'multiple' : undefined}
      options={selectOptions}
      style={{ width: '100%' }}
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
    />
  );
};

export default SelectSetter;
