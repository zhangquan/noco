/**
 * Variable Functions
 * 
 * Functions for variable operations.
 */

import type { FlowContext, VarNodeProps, FlowVarTypes } from '../../types';
import { resolveValue } from '../expressExc';
import { inferVarType, validateVarType } from '../../model/support-var-type';

/**
 * Get a variable value
 */
export function getVariable(
  context: FlowContext,
  name: string
): unknown {
  return context.variables[name];
}

/**
 * Set a variable value
 */
export function setVariable(
  context: FlowContext,
  name: string,
  value: unknown
): void {
  context.variables[name] = value;
}

/**
 * Check if a variable exists
 */
export function hasVariable(
  context: FlowContext,
  name: string
): boolean {
  return name in context.variables;
}

/**
 * Delete a variable
 */
export function deleteVariable(
  context: FlowContext,
  name: string
): boolean {
  if (name in context.variables) {
    delete context.variables[name];
    return true;
  }
  return false;
}

/**
 * Get all variable names
 */
export function getVariableNames(context: FlowContext): string[] {
  return Object.keys(context.variables);
}

/**
 * Execute a variable node
 */
export function executeVarNode(
  props: VarNodeProps,
  context: FlowContext
): unknown {
  const name = props.name || 'unnamed';
  const operation = props.operation || 'set';
  const value = resolveValue(props.value, context);

  switch (operation) {
    case 'set':
      if (props.varType) {
        if (!validateVarType(props.varType, value)) {
          throw new Error(
            `Value type mismatch: expected ${props.varType}, got ${inferVarType(value)}`
          );
        }
      }
      context.variables[name] = value;
      break;

    case 'increment':
      const currentNum = Number(context.variables[name]) || 0;
      const increment = Number(value) || 1;
      context.variables[name] = currentNum + increment;
      break;

    case 'decrement':
      const currentDec = Number(context.variables[name]) || 0;
      const decrement = Number(value) || 1;
      context.variables[name] = currentDec - decrement;
      break;

    case 'append':
      if (!Array.isArray(context.variables[name])) {
        context.variables[name] = [];
      }
      (context.variables[name] as unknown[]).push(value);
      break;

    case 'remove':
      if (Array.isArray(context.variables[name])) {
        const index = (context.variables[name] as unknown[]).indexOf(value);
        if (index > -1) {
          (context.variables[name] as unknown[]).splice(index, 1);
        }
      }
      break;

    default:
      throw new Error(`Unknown variable operation: ${operation}`);
  }

  return context.variables[name];
}

/**
 * Create a typed variable
 */
export function createTypedVariable(
  context: FlowContext,
  name: string,
  type: FlowVarTypes,
  initialValue?: unknown
): void {
  let value = initialValue;

  // Apply default value based on type if not provided
  if (value === undefined) {
    switch (type) {
      case 'string' as FlowVarTypes:
        value = '';
        break;
      case 'number' as FlowVarTypes:
        value = 0;
        break;
      case 'boolean' as FlowVarTypes:
        value = false;
        break;
      case 'object' as FlowVarTypes:
        value = {};
        break;
      case 'array' as FlowVarTypes:
        value = [];
        break;
      case 'date' as FlowVarTypes:
        value = new Date();
        break;
      case 'null' as FlowVarTypes:
        value = null;
        break;
    }
  }

  if (!validateVarType(type, value)) {
    throw new Error(`Invalid value for type ${type}`);
  }

  context.variables[name] = value;
}
