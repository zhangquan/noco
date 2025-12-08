/**
 * Supported Variable Types
 * 
 * Defines the variable types available in flows.
 */

import { FlowVarTypes } from '../types';

export interface VarTypeDefinition {
  /** Type value */
  type: FlowVarTypes;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Default value */
  defaultValue: unknown;
  /** Icon name */
  icon: string;
  /** Validator function */
  validate?: (value: unknown) => boolean;
}

/**
 * All supported variable types
 */
export const supportedVarTypes: VarTypeDefinition[] = [
  {
    type: FlowVarTypes.STRING,
    name: 'String',
    description: 'Text value',
    defaultValue: '',
    icon: 'font-size',
    validate: (value) => typeof value === 'string',
  },
  {
    type: FlowVarTypes.NUMBER,
    name: 'Number',
    description: 'Numeric value',
    defaultValue: 0,
    icon: 'number',
    validate: (value) => typeof value === 'number' && !isNaN(value),
  },
  {
    type: FlowVarTypes.BOOLEAN,
    name: 'Boolean',
    description: 'True or false',
    defaultValue: false,
    icon: 'check-circle',
    validate: (value) => typeof value === 'boolean',
  },
  {
    type: FlowVarTypes.OBJECT,
    name: 'Object',
    description: 'Key-value pairs',
    defaultValue: {},
    icon: 'code',
    validate: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  },
  {
    type: FlowVarTypes.ARRAY,
    name: 'Array',
    description: 'List of values',
    defaultValue: [],
    icon: 'ordered-list',
    validate: (value) => Array.isArray(value),
  },
  {
    type: FlowVarTypes.DATE,
    name: 'Date',
    description: 'Date/time value',
    defaultValue: null,
    icon: 'calendar',
    validate: (value) => value instanceof Date || typeof value === 'string',
  },
  {
    type: FlowVarTypes.NULL,
    name: 'Null',
    description: 'Empty value',
    defaultValue: null,
    icon: 'stop',
    validate: (value) => value === null,
  },
];

/**
 * Get variable type definition
 */
export function getVarTypeDefinition(type: FlowVarTypes): VarTypeDefinition | undefined {
  return supportedVarTypes.find((v) => v.type === type);
}

/**
 * Get default value for a variable type
 */
export function getVarTypeDefaultValue(type: FlowVarTypes): unknown {
  const def = getVarTypeDefinition(type);
  return def?.defaultValue;
}

/**
 * Validate a value against a variable type
 */
export function validateVarType(type: FlowVarTypes, value: unknown): boolean {
  const def = getVarTypeDefinition(type);
  if (!def?.validate) return true;
  return def.validate(value);
}

/**
 * Infer variable type from value
 */
export function inferVarType(value: unknown): FlowVarTypes {
  if (value === null) return FlowVarTypes.NULL;
  if (Array.isArray(value)) return FlowVarTypes.ARRAY;
  if (value instanceof Date) return FlowVarTypes.DATE;
  
  switch (typeof value) {
    case 'string':
      return FlowVarTypes.STRING;
    case 'number':
      return FlowVarTypes.NUMBER;
    case 'boolean':
      return FlowVarTypes.BOOLEAN;
    case 'object':
      return FlowVarTypes.OBJECT;
    default:
      return FlowVarTypes.STRING;
  }
}
