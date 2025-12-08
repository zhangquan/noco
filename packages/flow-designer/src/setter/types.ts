/**
 * Setter Types
 * Type definitions for property setters
 * @module setter/types
 */

import type React from 'react';
import type { FlowNodeType, ExpressionType } from '../types';

// ============================================================================
// Setter Field Types
// ============================================================================

/**
 * Base setter props
 */
export interface BaseSetterProps<T = unknown> {
  /** Field value */
  value?: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Support expression binding */
  supportExpression?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

/**
 * String setter props
 */
export interface StringSetterProps extends BaseSetterProps<string> {
  /** Maximum length */
  maxLength?: number;
  /** Show character count */
  showCount?: boolean;
  /** Multi-line input */
  multiline?: boolean;
  /** Number of rows for multiline */
  rows?: number;
}

/**
 * Number setter props
 */
export interface NumberSetterProps extends BaseSetterProps<number> {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step value */
  step?: number;
  /** Precision */
  precision?: number;
  /** Unit suffix */
  addonAfter?: string;
}

/**
 * Boolean setter props
 */
export interface BooleanSetterProps extends BaseSetterProps<boolean> {
  /** Checked label */
  checkedLabel?: string;
  /** Unchecked label */
  uncheckedLabel?: string;
}

/**
 * Select option
 */
export interface SelectOption {
  /** Option label */
  label: string;
  /** Option value */
  value: unknown;
  /** Whether disabled */
  disabled?: boolean;
  /** Option icon */
  icon?: React.ReactNode;
}

/**
 * Select setter props
 */
export interface SelectSetterProps extends BaseSetterProps<unknown> {
  /** Options */
  options: SelectOption[];
  /** Allow clear */
  allowClear?: boolean;
  /** Show search */
  showSearch?: boolean;
  /** Multiple selection */
  multiple?: boolean;
}

/**
 * Expression setter props
 */
export interface ExpressionSetterProps extends BaseSetterProps<ExpressionType | string> {
  /** Available variables */
  variables?: Array<{
    name: string;
    type: string;
    source: string;
  }>;
  /** Mode */
  mode?: 'simple' | 'advanced';
}

/**
 * Table select setter props
 */
export interface TableSelectSetterProps extends BaseSetterProps<string> {
  /** Available tables */
  tables?: Array<{
    id: string;
    title: string;
    columns?: Array<{
      id: string;
      title: string;
      type: string;
    }>;
  }>;
}

/**
 * Field select setter props
 */
export interface FieldSelectSetterProps extends BaseSetterProps<string | string[]> {
  /** Table ID to get fields from */
  tableId?: string;
  /** Available fields */
  fields?: Array<{
    id: string;
    title: string;
    type: string;
  }>;
  /** Multiple selection */
  multiple?: boolean;
}

/**
 * JSON setter props
 */
export interface JsonSetterProps extends BaseSetterProps<Record<string, unknown>> {
  /** JSON schema for validation */
  schema?: Record<string, unknown>;
  /** Show formatted */
  formatted?: boolean;
}

/**
 * Code setter props
 */
export interface CodeSetterProps extends BaseSetterProps<string> {
  /** Language */
  language?: 'javascript' | 'typescript' | 'json' | 'sql';
  /** Editor height */
  height?: number | string;
  /** Show line numbers */
  lineNumbers?: boolean;
}

// ============================================================================
// Setter Panel Types
// ============================================================================

/**
 * Setter panel props
 */
export interface SetterPanelProps {
  /** Current node being edited */
  node: FlowNodeType | null;
  /** Change handler */
  onChange: (updates: Partial<FlowNodeType>) => void;
  /** Props change handler */
  onPropsChange: (props: Record<string, unknown>) => void;
  /** Available tables */
  tables?: Array<{ id: string; title: string }>;
  /** Custom setters */
  customSetters?: Record<string, React.ComponentType<BaseSetterProps>>;
  /** Whether disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Setter section props
 */
export interface SetterSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Collapsible */
  collapsible?: boolean;
  /** Default collapsed */
  defaultCollapsed?: boolean;
  /** Children */
  children: React.ReactNode;
}

/**
 * Setter field wrapper props
 */
export interface SetterFieldProps {
  /** Field label */
  label: string;
  /** Field name */
  name: string;
  /** Required */
  required?: boolean;
  /** Help text */
  help?: string;
  /** Error message */
  error?: string;
  /** Tooltip */
  tooltip?: string;
  /** Children */
  children: React.ReactNode;
}
