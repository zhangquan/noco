/**
 * Setter Renderer
 * 
 * Renders the appropriate setter component based on configuration.
 */

import React from 'react';
import type { SetterConfig, FlowNodeProps, SetterType } from '../types';
import { FormItem } from './components/layout/FormItem';
import { StringSetter } from './components/base/StringSetter';
import { NumberSetter } from './components/base/NumberSetter';
import { BooleanSetter } from './components/base/BooleanSetter';
import { SelectSetter } from './components/base/SelectSetter';
import { TextareaSetter } from './components/base/TextareaSetter';
import { JsonSetter } from './components/base/JsonSetter';

export interface RenderSetterProps {
  /** Setter configuration */
  config: SetterConfig;
  /** Current props value */
  props: FlowNodeProps;
  /** Update props */
  onChange: (name: string, value: unknown) => void;
  /** Whether disabled */
  disabled?: boolean;
}

/**
 * Get the value from props by name
 */
function getValue(props: FlowNodeProps, name: string): unknown {
  return (props as Record<string, unknown>)[name];
}

/**
 * Render a setter component
 */
export const RenderSetter: React.FC<RenderSetterProps> = ({
  config,
  props,
  onChange,
  disabled,
}) => {
  // Check condition
  if (config.condition && !config.condition(props)) {
    return null;
  }

  const value = getValue(props, config.name);
  const handleChange = (newValue: unknown) => {
    onChange(config.name, newValue);
  };

  const commonProps = {
    name: config.name,
    value,
    onChange: handleChange,
    disabled,
    placeholder: config.placeholder,
    props: config.props,
  };

  let setterComponent: React.ReactNode;

  switch (config.type) {
    case 'string':
      setterComponent = <StringSetter {...commonProps} value={value as string} />;
      break;

    case 'number':
      setterComponent = <NumberSetter {...commonProps} value={value as number} />;
      break;

    case 'boolean':
      setterComponent = <BooleanSetter {...commonProps} value={value as boolean} />;
      break;

    case 'select':
    case 'radio':
      setterComponent = (
        <SelectSetter
          {...commonProps}
          props={{ ...config.props, options: config.options }}
        />
      );
      break;

    case 'textarea':
      setterComponent = <TextareaSetter {...commonProps} value={value as string} />;
      break;

    case 'json':
      setterComponent = <JsonSetter {...commonProps} />;
      break;

    case 'expression':
      setterComponent = <StringSetter {...commonProps} value={value as string} />;
      break;

    case 'custom':
      // Custom setters should be provided via config.props.component
      const CustomComponent = config.props?.component as React.ComponentType<typeof commonProps>;
      if (CustomComponent) {
        setterComponent = <CustomComponent {...commonProps} />;
      } else {
        setterComponent = <div>Custom setter not configured</div>;
      }
      break;

    default:
      setterComponent = <StringSetter {...commonProps} value={String(value || '')} />;
  }

  return (
    <FormItem
      label={config.label}
      help={config.help}
      required={config.required}
    >
      {setterComponent}
    </FormItem>
  );
};

/**
 * Render multiple setters
 */
export interface RenderSettersProps {
  /** Setter configurations */
  setters: SetterConfig[];
  /** Current props value */
  props: FlowNodeProps;
  /** Update props */
  onChange: (name: string, value: unknown) => void;
  /** Whether disabled */
  disabled?: boolean;
}

export const RenderSetters: React.FC<RenderSettersProps> = ({
  setters,
  props,
  onChange,
  disabled,
}) => {
  return (
    <>
      {setters.map((config) => (
        <RenderSetter
          key={config.name}
          config={config}
          props={props}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </>
  );
};

export default RenderSetter;
