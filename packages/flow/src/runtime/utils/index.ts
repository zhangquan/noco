/**
 * Runtime Utilities
 */

import type { FlowContext, FlowSchemaType, FlowNodeType } from '../../types';

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a new flow context
 */
export function createFlowContext(
  eventData: Record<string, unknown> = {},
  initialContext: Record<string, unknown> = {}
): FlowContext {
  return {
    eventData,
    flowData: {},
    loopData: undefined,
    context: {
      timestamp: Date.now(),
      ...initialContext,
    },
    variables: {},
  };
}

/**
 * Merge context data
 */
export function mergeContext(
  base: FlowContext,
  updates: Partial<FlowContext>
): FlowContext {
  return {
    ...base,
    eventData: { ...base.eventData, ...updates.eventData },
    flowData: { ...base.flowData, ...updates.flowData },
    context: { ...base.context, ...updates.context },
    variables: { ...base.variables, ...updates.variables },
    loopData: updates.loopData ?? base.loopData,
  };
}

/**
 * Get all node IDs from a schema
 */
export function getAllNodeIds(schema: FlowSchemaType): string[] {
  const ids: string[] = [];

  function collect(node: FlowNodeType) {
    ids.push(node.id);
    node.actions?.forEach(collect);
    node.conditions?.forEach((c) => {
      ids.push(c.id);
      c.actions?.forEach(collect);
    });
  }

  ids.push(schema.id);
  schema.actions?.forEach(collect);

  return ids;
}

/**
 * Format duration in human readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Sanitize error message for display
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Check if a value is a promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in value &&
    typeof (value as Promise<unknown>).then === 'function'
  );
}

/**
 * Timeout wrapper for async operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Retry wrapper for async operations
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const waitTime = delay * Math.pow(backoff, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}
