/**
 * Expression Executor
 * 
 * Executes expression bindings and resolves dynamic values.
 */

import type { FlowContext, ExpressionType } from '../types';
import { isExpression } from '../types';

/**
 * Expression pattern for matching {variable.path} syntax
 */
const EXPRESSION_PATTERN = /\{([^}]+)\}/g;

/**
 * Get value from nested object path
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index access
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Resolve an expression value from context
 */
export function resolveExpression(
  expression: string,
  context: FlowContext
): unknown {
  // Build combined data object for resolution
  const data: Record<string, unknown> = {
    eventData: context.eventData,
    flowData: context.flowData,
    loopData: context.loopData,
    context: context.context,
    variables: context.variables,
  };

  // Check if it's a simple variable reference (no operators)
  const simpleMatch = expression.match(/^\{([^}]+)\}$/);
  if (simpleMatch) {
    return getValueByPath(data, simpleMatch[1]);
  }

  // Handle complex expressions with operators
  // Replace all {variable} patterns with their values
  let result = expression;
  let hasReplacement = false;

  result = result.replace(EXPRESSION_PATTERN, (match, path) => {
    hasReplacement = true;
    const value = getValueByPath(data, path);
    
    if (value === undefined || value === null) {
      return 'null';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  });

  // If no replacements were made, return original expression
  if (!hasReplacement) {
    return expression;
  }

  // Try to evaluate as a JavaScript expression
  try {
    // Only evaluate if it looks like an expression (has operators)
    if (/[+\-*/<>=!&|]/.test(result)) {
      // Safe evaluation using Function constructor
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return ${result}`);
      return fn();
    }
    
    // If it's just a replaced string, return as-is
    return result;
  } catch {
    // If evaluation fails, return the string
    return result;
  }
}

/**
 * Resolve a value that might be an expression
 */
export function resolveValue(
  value: unknown,
  context: FlowContext
): unknown {
  if (isExpression(value)) {
    return resolveExpression(value.value, context);
  }

  if (typeof value === 'string' && value.includes('{') && value.includes('}')) {
    return resolveExpression(value, context);
  }

  return value;
}

/**
 * Resolve all expressions in an object
 */
export function resolveObject(
  obj: Record<string, unknown>,
  context: FlowContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (isExpression(value)) {
      result[key] = resolveExpression(value.value, context);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = resolveObject(value as Record<string, unknown>, context);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? resolveObject(item as Record<string, unknown>, context)
          : resolveValue(item, context)
      );
    } else if (typeof value === 'string') {
      result[key] = resolveValue(value, context);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Evaluate a condition expression
 */
export function evaluateCondition(
  condition: ExpressionType | string | undefined,
  context: FlowContext
): boolean {
  if (!condition) {
    return true; // Empty condition is always true (default branch)
  }

  const expression = typeof condition === 'string' ? condition : condition.value;
  const result = resolveExpression(expression, context);

  // Convert result to boolean
  if (typeof result === 'boolean') {
    return result;
  }

  if (typeof result === 'number') {
    return result !== 0;
  }

  if (typeof result === 'string') {
    // Try to parse as boolean
    if (result === 'true') return true;
    if (result === 'false') return false;
    return result.length > 0;
  }

  return Boolean(result);
}

/**
 * Check if a value contains expressions
 */
export function hasExpressions(value: unknown): boolean {
  if (isExpression(value)) {
    return true;
  }

  if (typeof value === 'string') {
    return EXPRESSION_PATTERN.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(hasExpressions);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(hasExpressions);
  }

  return false;
}
