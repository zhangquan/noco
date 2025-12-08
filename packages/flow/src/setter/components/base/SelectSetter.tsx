/**
 * Select Setter Component
 */

import React from 'react';
import { Select } from 'antd';
import type { SetterProps, SelectOption } from '../../types';

export interface SelectSetterProps extends SetterProps<unknown> {
  options?: SelectOption[];
  multiple?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
}

export const SelectSetter: React.FC<SelectSetterProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
  props,
}) => {
  const options = (props?.options as SelectOption[]) || [];
  const multiple = props?.multiple as boolean | undefined;
  const allowClear = props?.allowClear as boolean ?? true;
  const showSearch = props?.showSearch as boolean ?? true;

  // Group options if they have group property
  const groupedOptions = options.reduce((acc, opt) => {
    const group = opt.group || '';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(opt);
    return acc;
  }, {} as Record<string, SelectOption[]>);

  const hasGroups = Object.keys(groupedOptions).some((g) => g !== '');

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      mode={multiple ? 'multiple' : undefined}
      allowClear={allowClear}
      showSearch={showSearch}
      style={{ width: '100%' }}
      filterOption={(input, option) =>
        (option?.label?.toString() || '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
    >
      {hasGroups
        ? Object.entries(groupedOptions).map(([group, opts]) =>
            group ? (
              <Select.OptGroup key={group} label={group}>
                {opts.map((opt) => (
                  <Select.Option
                    key={String(opt.value)}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </Select.Option>
                ))}
              </Select.OptGroup>
            ) : (
              opts.map((opt) => (
                <Select.Option
                  key={String(opt.value)}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  {opt.label}
                </Select.Option>
              ))
            )
          )
        : options.map((opt) => (
            <Select.Option
              key={String(opt.value)}
              value={opt.value}
              disabled={opt.disabled}
            >
              {opt.label}
            </Select.Option>
          ))}
    </Select>
  );
};

export default SelectSetter;
