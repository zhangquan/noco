/**
 * Flow Invoker
 * 
 * Main entry point for executing flow schemas.
 */

import type {
  FlowSchemaType,
  FlowNodeType,
  FlowConditionNodeType,
  FlowContext,
  FlowExecutionResult,
  FlowExecutionLog,
  FlowNodeTypes,
  DataListNodeProps,
  DataInsertNodeProps,
  DataUpdateNodeProps,
  DataDeleteNodeProps,
  VarNodeProps,
  LoopNodeProps,
} from '../types';
import { nodeRegistry } from '../model/register';
import { resolveValue, resolveObject, evaluateCondition } from './expressExc';

/**
 * Flow execution options
 */
export interface InvokeFlowOptions {
  /** Initial event data */
  eventData?: Record<string, unknown>;
  /** Global context data */
  context?: Record<string, unknown>;
  /** Maximum execution time in ms */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Data API functions */
  dataApi?: DataApiInterface;
}

/**
 * Data API interface for database operations
 */
export interface DataApiInterface {
  list: (params: {
    tableId: string;
    viewId?: string;
    filters?: unknown[];
    limit?: number;
    offset?: number;
    sort?: unknown[];
    fields?: string[];
  }) => Promise<unknown[]>;
  
  insert: (params: {
    tableId: string;
    viewId?: string;
    body: Record<string, unknown>;
  }) => Promise<unknown>;
  
  update: (params: {
    tableId: string;
    viewId?: string;
    rowId?: string;
    body: Record<string, unknown>;
    filters?: unknown[];
  }) => Promise<unknown>;
  
  delete: (params: {
    tableId: string;
    viewId?: string;
    rowId?: string;
    filters?: unknown[];
  }) => Promise<void>;
}

/**
 * Create initial flow context
 */
function createContext(options: InvokeFlowOptions): FlowContext {
  return {
    eventData: options.eventData || {},
    flowData: {},
    loopData: undefined,
    context: {
      timestamp: Date.now(),
      ...options.context,
    },
    variables: {},
  };
}

/**
 * Execute a single node
 */
async function executeNode(
  node: FlowNodeType,
  context: FlowContext,
  options: InvokeFlowOptions,
  logs: FlowExecutionLog[]
): Promise<unknown> {
  const startTime = Date.now();
  
  const log = (level: FlowExecutionLog['level'], message: string, data?: unknown) => {
    logs.push({
      timestamp: Date.now(),
      nodeId: node.id,
      level,
      message,
      data,
    });
  };

  if (options.debug) {
    log('debug', `Executing node: ${node.actionType}`, { props: node.props });
  }

  try {
    // Check for custom executor
    const executor = nodeRegistry.getExecutor(node.actionType);
    if (executor) {
      const result = await executor(node, context, node.props || {});
      context.flowData[node.id] = result;
      return result;
    }

    // Built-in node execution
    switch (node.actionType) {
      case 'dataList' as FlowNodeTypes: {
        const props = node.props as DataListNodeProps;
        if (!options.dataApi) {
          throw new Error('Data API not provided');
        }
        
        const result = await options.dataApi.list({
          tableId: props.tableId!,
          viewId: props.viewId,
          filters: props.filters?.map((f) => ({
            ...f,
            value: resolveValue(f.value, context),
          })),
          limit: resolveValue(props.limit, context) as number | undefined,
          offset: resolveValue(props.offset, context) as number | undefined,
          sort: props.sort,
          fields: props.fields,
        });
        
        context.flowData[node.id] = result;
        log('info', `Fetched ${(result as unknown[]).length} records`);
        return result;
      }

      case 'dataInsert' as FlowNodeTypes: {
        const props = node.props as DataInsertNodeProps;
        if (!options.dataApi) {
          throw new Error('Data API not provided');
        }
        
        const body = resolveObject(props.body || {}, context);
        const result = await options.dataApi.insert({
          tableId: props.tableId!,
          viewId: props.viewId,
          body,
        });
        
        context.flowData[node.id] = result;
        log('info', 'Inserted record', result);
        return result;
      }

      case 'dataUpdate' as FlowNodeTypes: {
        const props = node.props as DataUpdateNodeProps;
        if (!options.dataApi) {
          throw new Error('Data API not provided');
        }
        
        const body = resolveObject(props.body || {}, context);
        const rowId = resolveValue(props.rowId, context) as string | undefined;
        
        const result = await options.dataApi.update({
          tableId: props.tableId!,
          viewId: props.viewId,
          rowId,
          body,
          filters: props.filters?.map((f) => ({
            ...f,
            value: resolveValue(f.value, context),
          })),
        });
        
        context.flowData[node.id] = result;
        log('info', 'Updated record', result);
        return result;
      }

      case 'dataDelete' as FlowNodeTypes: {
        const props = node.props as DataDeleteNodeProps;
        if (!options.dataApi) {
          throw new Error('Data API not provided');
        }
        
        const rowId = resolveValue(props.rowId, context) as string | undefined;
        
        await options.dataApi.delete({
          tableId: props.tableId!,
          viewId: props.viewId,
          rowId,
          filters: props.filters?.map((f) => ({
            ...f,
            value: resolveValue(f.value, context),
          })),
        });
        
        context.flowData[node.id] = { deleted: true };
        log('info', 'Deleted record(s)');
        return { deleted: true };
      }

      case 'var' as FlowNodeTypes: {
        const props = node.props as VarNodeProps;
        const name = props.name || node.id;
        const value = resolveValue(props.value, context);
        
        switch (props.operation) {
          case 'set':
            context.variables[name] = value;
            break;
          case 'increment':
            context.variables[name] = (Number(context.variables[name]) || 0) + (Number(value) || 1);
            break;
          case 'decrement':
            context.variables[name] = (Number(context.variables[name]) || 0) - (Number(value) || 1);
            break;
          case 'append':
            if (!Array.isArray(context.variables[name])) {
              context.variables[name] = [];
            }
            (context.variables[name] as unknown[]).push(value);
            break;
          case 'remove':
            if (Array.isArray(context.variables[name])) {
              context.variables[name] = (context.variables[name] as unknown[]).filter(
                (v) => v !== value
              );
            }
            break;
          default:
            context.variables[name] = value;
        }
        
        context.flowData[node.id] = context.variables[name];
        log('info', `Variable ${name} set to:`, context.variables[name]);
        return context.variables[name];
      }

      case 'if' as FlowNodeTypes: {
        // IF nodes are handled separately
        return null;
      }

      case 'loop' as FlowNodeTypes: {
        const props = node.props as LoopNodeProps;
        const source = resolveValue(props.source, context);
        
        if (!Array.isArray(source)) {
          log('warn', 'Loop source is not an array');
          return [];
        }
        
        const results: unknown[] = [];
        const maxIterations = props.maxIterations || 1000;
        const itemVar = props.itemVar || 'item';
        const indexVar = props.indexVar || 'index';
        
        for (let i = 0; i < Math.min(source.length, maxIterations); i++) {
          context.loopData = {
            item: source[i],
            index: i,
            array: source,
          };
          context.variables[itemVar] = source[i];
          context.variables[indexVar] = i;
          
          if (node.actions) {
            const result = await executeActions(node.actions, context, options, logs);
            results.push(result);
          }
        }
        
        context.loopData = undefined;
        context.flowData[node.id] = results;
        log('info', `Loop completed with ${results.length} iterations`);
        return results;
      }

      default:
        log('warn', `Unknown node type: ${node.actionType}`);
        return null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('error', `Node execution failed: ${message}`);
    throw error;
  }
}

/**
 * Execute IF node with conditions
 */
async function executeIfNode(
  node: FlowNodeType,
  context: FlowContext,
  options: InvokeFlowOptions,
  logs: FlowExecutionLog[]
): Promise<unknown> {
  if (!node.conditions || node.conditions.length === 0) {
    return null;
  }

  logs.push({
    timestamp: Date.now(),
    nodeId: node.id,
    level: 'info',
    message: 'Evaluating conditions',
  });

  // Find the first matching condition
  for (const condition of node.conditions) {
    const matches = evaluateCondition(condition.props?.expression, context);
    
    logs.push({
      timestamp: Date.now(),
      nodeId: condition.id,
      level: 'debug',
      message: `Condition "${condition.props?.title || 'unnamed'}": ${matches}`,
    });

    if (matches) {
      context.flowData[node.id] = { matchedCondition: condition.id };
      
      if (condition.actions && condition.actions.length > 0) {
        return executeActions(condition.actions, context, options, logs);
      }
      return null;
    }
  }

  // No condition matched
  context.flowData[node.id] = { matchedCondition: null };
  return null;
}

/**
 * Execute a list of actions
 */
async function executeActions(
  actions: FlowNodeType[],
  context: FlowContext,
  options: InvokeFlowOptions,
  logs: FlowExecutionLog[]
): Promise<unknown> {
  let lastResult: unknown = null;

  for (const action of actions) {
    if (action.actionType === ('if' as FlowNodeTypes)) {
      lastResult = await executeIfNode(action, context, options, logs);
    } else {
      lastResult = await executeNode(action, context, options, logs);
    }
  }

  return lastResult;
}

/**
 * Invoke a flow with the given schema and options
 */
export async function invokeFlow(
  schema: FlowSchemaType,
  options: InvokeFlowOptions = {}
): Promise<FlowExecutionResult> {
  const startTime = Date.now();
  const logs: FlowExecutionLog[] = [];
  const context = createContext(options);

  // Set up timeout
  const timeout = options.timeout || 30000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Flow execution timeout')), timeout);
  });

  try {
    logs.push({
      timestamp: Date.now(),
      nodeId: schema.id,
      level: 'info',
      message: 'Flow execution started',
      data: { eventData: context.eventData },
    });

    // Execute main flow with timeout
    const executionPromise = executeActions(
      schema.actions || [],
      context,
      options,
      logs
    );

    const result = await Promise.race([executionPromise, timeoutPromise]);

    logs.push({
      timestamp: Date.now(),
      nodeId: schema.id,
      level: 'info',
      message: 'Flow execution completed',
    });

    return {
      success: true,
      data: {
        result,
        flowData: context.flowData,
        variables: context.variables,
      },
      logs,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    logs.push({
      timestamp: Date.now(),
      nodeId: schema.id,
      level: 'error',
      message: `Flow execution failed: ${message}`,
    });

    return {
      success: false,
      error: {
        message,
        code: 'EXECUTION_ERROR',
      },
      logs,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Create a flow invoker with pre-configured options
 */
export function createFlowInvoker(defaultOptions: InvokeFlowOptions) {
  return (schema: FlowSchemaType, options: InvokeFlowOptions = {}) =>
    invokeFlow(schema, { ...defaultOptions, ...options });
}
