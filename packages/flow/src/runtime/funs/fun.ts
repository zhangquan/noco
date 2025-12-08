/**
 * Custom Function Executor
 * 
 * Executes custom functions defined in the flow.
 */

import type { FlowContext, FnNodeProps } from '../../types';
import { resolveValue } from '../expressExc';
import { getFunctionDefinition } from '../../model/support-funs';

/**
 * Execute a built-in function
 */
export function executeBuiltinFunction(
  fnName: string,
  args: unknown[],
  context: FlowContext
): unknown {
  const def = getFunctionDefinition(fnName);
  if (!def) {
    throw new Error(`Unknown function: ${fnName}`);
  }

  // Resolve all arguments
  const resolvedArgs = args.map((arg) => resolveValue(arg, context));

  switch (fnName) {
    // String functions
    case 'concat':
      return (resolvedArgs[0] as unknown[]).join(resolvedArgs[1] as string || '');
    case 'substring':
      return String(resolvedArgs[0]).substring(
        resolvedArgs[1] as number,
        resolvedArgs[2] as number | undefined
      );
    case 'toUpperCase':
      return String(resolvedArgs[0]).toUpperCase();
    case 'toLowerCase':
      return String(resolvedArgs[0]).toLowerCase();
    case 'trim':
      return String(resolvedArgs[0]).trim();
    case 'replace':
      return String(resolvedArgs[0]).replace(
        String(resolvedArgs[1]),
        String(resolvedArgs[2])
      );

    // Math functions
    case 'add':
      return Number(resolvedArgs[0]) + Number(resolvedArgs[1]);
    case 'subtract':
      return Number(resolvedArgs[0]) - Number(resolvedArgs[1]);
    case 'multiply':
      return Number(resolvedArgs[0]) * Number(resolvedArgs[1]);
    case 'divide':
      return Number(resolvedArgs[0]) / Number(resolvedArgs[1]);
    case 'round':
      const decimals = resolvedArgs[1] as number || 0;
      const factor = Math.pow(10, decimals);
      return Math.round(Number(resolvedArgs[0]) * factor) / factor;
    case 'floor':
      return Math.floor(Number(resolvedArgs[0]));
    case 'ceil':
      return Math.ceil(Number(resolvedArgs[0]));
    case 'abs':
      return Math.abs(Number(resolvedArgs[0]));
    case 'min':
      return Math.min(...(resolvedArgs[0] as number[]));
    case 'max':
      return Math.max(...(resolvedArgs[0] as number[]));

    // Date functions
    case 'now':
      return new Date();
    case 'formatDate':
      // Simple date formatting
      const date = new Date(resolvedArgs[0] as string | number | Date);
      const format = resolvedArgs[1] as string;
      return formatDate(date, format);
    case 'addDays':
      const baseDate = new Date(resolvedArgs[0] as string | number | Date);
      baseDate.setDate(baseDate.getDate() + Number(resolvedArgs[1]));
      return baseDate;
    case 'diffDays':
      const date1 = new Date(resolvedArgs[0] as string | number | Date);
      const date2 = new Date(resolvedArgs[1] as string | number | Date);
      return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));

    // Array functions
    case 'length':
      return (resolvedArgs[0] as unknown[]).length;
    case 'first':
      return (resolvedArgs[0] as unknown[])[0];
    case 'last':
      const arr = resolvedArgs[0] as unknown[];
      return arr[arr.length - 1];
    case 'sum':
      return (resolvedArgs[0] as number[]).reduce((a, b) => a + b, 0);
    case 'average':
      const nums = resolvedArgs[0] as number[];
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'filter':
      const filterArr = resolvedArgs[0] as Record<string, unknown>[];
      const field = resolvedArgs[1] as string;
      const value = resolvedArgs[2];
      return filterArr.filter((item) => item[field] === value);
    case 'map':
      const mapArr = resolvedArgs[0] as Record<string, unknown>[];
      const mapField = resolvedArgs[1] as string;
      return mapArr.map((item) => item[mapField]);

    // Logic functions
    case 'if':
      return resolvedArgs[0] ? resolvedArgs[1] : resolvedArgs[2];
    case 'and':
      return (resolvedArgs[0] as boolean[]).every(Boolean);
    case 'or':
      return (resolvedArgs[0] as boolean[]).some(Boolean);
    case 'not':
      return !resolvedArgs[0];
    case 'isEmpty':
      const val = resolvedArgs[0];
      if (val === null || val === undefined) return true;
      if (typeof val === 'string') return val.length === 0;
      if (Array.isArray(val)) return val.length === 0;
      if (typeof val === 'object') return Object.keys(val).length === 0;
      return false;
    case 'isNull':
      return resolvedArgs[0] === null || resolvedArgs[0] === undefined;

    default:
      throw new Error(`Function not implemented: ${fnName}`);
  }
}

/**
 * Execute a custom (user-defined) function
 */
export function executeCustomFunction(
  code: string,
  args: unknown[],
  context: FlowContext
): unknown {
  // Create a sandboxed function
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'args',
    'eventData',
    'flowData',
    'variables',
    'context',
    code
  );

  return fn(
    args,
    context.eventData,
    context.flowData,
    context.variables,
    context.context
  );
}

/**
 * Execute a function node
 */
export function executeFnNode(
  props: FnNodeProps,
  context: FlowContext
): unknown {
  // Resolve arguments
  const resolvedArgs = (props.args || []).map((arg) => resolveValue(arg, context));

  if (props.code) {
    // Custom function
    return executeCustomFunction(props.code, resolvedArgs, context);
  } else if (props.fnName) {
    // Built-in function
    return executeBuiltinFunction(props.fnName, resolvedArgs, context);
  }

  throw new Error('Function node must have either fnName or code');
}

/**
 * Simple date formatter
 */
function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}
