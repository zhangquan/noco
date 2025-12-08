/**
 * Setter Types
 * 
 * Type definitions for property setters.
 */

import type { SetterType, FlowNodeProps, ExpressionType } from '../types';

/**
 * Setter component props
 */
export interface SetterProps<T = unknown> {
  /** Property name */
  name: string;
  /** Current value */
  value: T | undefined;
  /** Called when value changes */
  onChange: (value: T | undefined) => void;
  /** Whether disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional props */
  props?: Record<string, unknown>;
}

/**
 * Setter with expression support
 */
export interface ExpressionSetterProps<T = unknown> extends SetterProps<T | ExpressionType> {
  /** Whether to allow expression binding */
  allowExpression?: boolean;
  /** Available variables for expression */
  variables?: VariableOption[];
}

/**
 * Variable option for expression binding
 */
export interface VariableOption {
  /** Variable path */
  path: string;
  /** Display label */
  label: string;
  /** Variable type */
  type?: string;
  /** Child variables */
  children?: VariableOption[];
}

/**
 * Select option
 */
export interface SelectOption {
  /** Option value */
  value: unknown;
  /** Display label */
  label: string;
  /** Whether disabled */
  disabled?: boolean;
  /** Group name */
  group?: string;
}

/**
 * Table selector props
 */
export interface TableSelectorProps extends SetterProps<string> {
  /** Available tables */
  tables: Array<{ id: string; name: string }>;
}

/**
 * View selector props
 */
export interface ViewSelectorProps extends SetterProps<string> {
  /** Table ID to filter views */
  tableId?: string;
  /** Available views by table */
  views: Record<string, Array<{ id: string; name: string }>>;
}

/**
 * Field selector props
 */
export interface FieldSelectorProps extends SetterProps<string | string[]> {
  /** Table ID to filter fields */
  tableId?: string;
  /** Available fields by table */
  fields: Record<string, Array<{ id: string; name: string; type: string }>>;
  /** Allow multiple selection */
  multiple?: boolean;
}

/**
 * Filter setter props
 */
export interface FilterSetterProps extends SetterProps<unknown[]> {
  /** Table ID for field options */
  tableId?: string;
  /** Available fields */
  fields: Record<string, Array<{ id: string; name: string; type: string }>>;
  /** Available variables for expression */
  variables?: VariableOption[];
}

/**
 * Body (data) setter props
 */
export interface BodySetterProps extends SetterProps<Record<string, unknown>> {
  /** Table ID for field options */
  tableId?: string;
  /** Available fields */
  fields: Record<string, Array<{ id: string; name: string; type: string }>>;
  /** Available variables for expression */
  variables?: VariableOption[];
}

/**
 * Setter configuration
 */
export interface SetterDefinition {
  /** Setter type */
  type: SetterType;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Component */
  component: React.ComponentType<SetterProps<unknown>>;
  /** Default props */
  defaultProps?: Record<string, unknown>;
}

/**
 * Setter registry type
 */
export type SetterRegistry = Map<SetterType, SetterDefinition>;
