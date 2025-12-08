/**
 * Flow Runtime Type Definitions
 * Types for flow execution, triggers, and context
 * @module flow-runtime/types
 */

import type { FlowSchema, NodeData, EdgeData, NodeType } from '@workspace/flow-designer';

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execution status
 */
export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Node execution status
 */
export type NodeExecutionStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Execution priority
 */
export type ExecutionPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Execution run record
 */
export interface ExecutionRun {
  /** Unique run ID */
  id: string;
  /** Flow ID */
  flowId: string;
  /** Flow schema at time of execution */
  flowSchema: FlowSchema;
  /** Current status */
  status: ExecutionStatus;
  /** Priority level */
  priority: ExecutionPriority;
  /** Trigger data that started this run */
  triggerData: TriggerData;
  /** Input data */
  inputs: Record<string, unknown>;
  /** Output data (after completion) */
  outputs?: Record<string, unknown>;
  /** Error information (if failed) */
  error?: ExecutionError;
  /** Node execution states */
  nodeStates: Map<string, NodeExecutionState>;
  /** Execution variables */
  variables: Map<string, unknown>;
  /** Started timestamp */
  startedAt: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Execution duration (ms) */
  duration?: number;
  /** Retry count */
  retryCount: number;
  /** Parent run ID (for sub-flows) */
  parentRunId?: string;
  /** Metadata */
  meta?: Record<string, unknown>;
}

/**
 * Node execution state
 */
export interface NodeExecutionState {
  /** Node ID */
  nodeId: string;
  /** Execution status */
  status: NodeExecutionStatus;
  /** Input data received */
  inputs: Record<string, unknown>;
  /** Output data produced */
  outputs: Record<string, unknown>;
  /** Error if failed */
  error?: ExecutionError;
  /** Started timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Duration (ms) */
  duration?: number;
  /** Retry count */
  retryCount: number;
  /** Logs produced by this node */
  logs: ExecutionLog[];
}

/**
 * Execution error
 */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Node that caused the error */
  nodeId?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Associated node ID */
  nodeId?: string;
  /** Additional data */
  data?: unknown;
}

// ============================================================================
// Execution Context Types
// ============================================================================

/**
 * Execution context - passed to node executors
 */
export interface ExecutionContext {
  /** Current run */
  run: ExecutionRun;
  /** Current node being executed */
  node: NodeData;
  /** Get variable value */
  getVariable: (name: string) => unknown;
  /** Set variable value */
  setVariable: (name: string, value: unknown) => void;
  /** Log a message */
  log: (level: ExecutionLog['level'], message: string, data?: unknown) => void;
  /** Get input value */
  getInput: (portId: string) => unknown;
  /** Set output value */
  setOutput: (portId: string, value: unknown) => void;
  /** Execute a child node */
  executeChild: (nodeId: string, inputs?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Cancel execution */
  cancel: (reason?: string) => void;
  /** Check if cancelled */
  isCancelled: () => boolean;
  /** Sleep/delay */
  sleep: (ms: number) => Promise<void>;
  /** HTTP client */
  http: HttpClient;
  /** Environment variables */
  env: Record<string, string>;
  /** Project context */
  project: ProjectContext;
}

/**
 * HTTP client interface
 */
export interface HttpClient {
  get: (url: string, options?: HttpRequestOptions) => Promise<HttpResponse>;
  post: (url: string, body?: unknown, options?: HttpRequestOptions) => Promise<HttpResponse>;
  put: (url: string, body?: unknown, options?: HttpRequestOptions) => Promise<HttpResponse>;
  patch: (url: string, body?: unknown, options?: HttpRequestOptions) => Promise<HttpResponse>;
  delete: (url: string, options?: HttpRequestOptions) => Promise<HttpResponse>;
  request: (options: HttpRequestOptions) => Promise<HttpResponse>;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  auth?: {
    type: 'basic' | 'bearer' | 'api-key';
    credentials: Record<string, string>;
  };
}

/**
 * HTTP response
 */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  ok: boolean;
}

/**
 * Project context
 */
export interface ProjectContext {
  id: string;
  name: string;
  /** Query records from a table */
  query: (tableId: string, options?: QueryOptions) => Promise<QueryResult>;
  /** Create a record */
  create: (tableId: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Update a record */
  update: (tableId: string, recordId: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Delete a record */
  delete: (tableId: string, recordId: string) => Promise<boolean>;
  /** Get a record by ID */
  getById: (tableId: string, recordId: string) => Promise<Record<string, unknown> | null>;
}

/**
 * Query options
 */
export interface QueryOptions {
  filters?: QueryFilter[];
  sorts?: QuerySort[];
  limit?: number;
  offset?: number;
  fields?: string[];
}

/**
 * Query filter
 */
export interface QueryFilter {
  field: string;
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'nin' | 'null' | 'notNull';
  value: unknown;
}

/**
 * Query sort
 */
export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Query result
 */
export interface QueryResult {
  records: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
}

// ============================================================================
// Trigger Types
// ============================================================================

/**
 * Trigger data
 */
export interface TriggerData {
  /** Trigger type */
  type: 'manual' | 'schedule' | 'webhook' | 'record' | 'form';
  /** Source identifier */
  source: string;
  /** Timestamp when triggered */
  timestamp: Date;
  /** Trigger-specific payload */
  payload: TriggerPayload;
}

/**
 * Trigger payload - union of all trigger types
 */
export type TriggerPayload = 
  | ManualTriggerPayload
  | ScheduleTriggerPayload
  | WebhookTriggerPayload
  | RecordTriggerPayload
  | FormTriggerPayload;

/**
 * Manual trigger payload
 */
export interface ManualTriggerPayload {
  type: 'manual';
  userId?: string;
  inputs?: Record<string, unknown>;
}

/**
 * Schedule trigger payload
 */
export interface ScheduleTriggerPayload {
  type: 'schedule';
  scheduledTime: Date;
  cron?: string;
  interval?: number;
}

/**
 * Webhook trigger payload
 */
export interface WebhookTriggerPayload {
  type: 'webhook';
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  ip?: string;
}

/**
 * Record trigger payload
 */
export interface RecordTriggerPayload {
  type: 'record';
  event: 'create' | 'update' | 'delete';
  tableId: string;
  recordId: string;
  record: Record<string, unknown>;
  previousRecord?: Record<string, unknown>;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

/**
 * Form trigger payload
 */
export interface FormTriggerPayload {
  type: 'form';
  formId: string;
  submissionId: string;
  data: Record<string, unknown>;
  submittedBy?: string;
}

// ============================================================================
// Node Executor Types
// ============================================================================

/**
 * Node executor function type
 */
export type NodeExecutor = (
  context: ExecutionContext,
  config: Record<string, unknown>
) => Promise<void>;

/**
 * Node executor definition
 */
export interface NodeExecutorDef {
  /** Node type this executor handles */
  type: NodeType;
  /** Executor function */
  execute: NodeExecutor;
  /** Validate node config before execution */
  validate?: (config: Record<string, unknown>) => ValidationResult;
  /** Initialize executor (called once at startup) */
  init?: () => Promise<void>;
  /** Cleanup executor (called at shutdown) */
  cleanup?: () => Promise<void>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Engine Types
// ============================================================================

/**
 * Engine configuration
 */
export interface EngineConfig {
  /** Maximum concurrent executions */
  maxConcurrent?: number;
  /** Default execution timeout (ms) */
  defaultTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delay: number;
    backoffMultiplier?: number;
  };
  /** Custom node executors */
  customExecutors?: NodeExecutorDef[];
}

/**
 * Engine status
 */
export interface EngineStatus {
  /** Engine is running */
  running: boolean;
  /** Active execution count */
  activeExecutions: number;
  /** Queued execution count */
  queuedExecutions: number;
  /** Total executions processed */
  totalExecutions: number;
  /** Failed executions count */
  failedExecutions: number;
  /** Average execution time (ms) */
  avgExecutionTime: number;
  /** Engine started at */
  startedAt?: Date;
}

/**
 * Execution event types
 */
export type ExecutionEventType = 
  | 'execution:start'
  | 'execution:complete'
  | 'execution:fail'
  | 'execution:cancel'
  | 'node:start'
  | 'node:complete'
  | 'node:fail'
  | 'node:skip';

/**
 * Execution event
 */
export interface ExecutionEvent {
  type: ExecutionEventType;
  runId: string;
  nodeId?: string;
  timestamp: Date;
  data?: unknown;
}

/**
 * Execution event listener
 */
export type ExecutionEventListener = (event: ExecutionEvent) => void;

// ============================================================================
// Trigger Handler Types
// ============================================================================

/**
 * Trigger handler interface
 */
export interface TriggerHandler {
  /** Trigger type */
  type: TriggerData['type'];
  /** Initialize handler */
  init?: () => Promise<void>;
  /** Cleanup handler */
  cleanup?: () => Promise<void>;
  /** Register a flow for this trigger */
  register: (flowId: string, config: Record<string, unknown>) => Promise<void>;
  /** Unregister a flow */
  unregister: (flowId: string) => Promise<void>;
  /** Handle incoming trigger (returns flow IDs to execute) */
  handle?: (payload: TriggerPayload) => Promise<string[]>;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Execution store interface
 */
export interface ExecutionStore {
  /** Save an execution run */
  save: (run: ExecutionRun) => Promise<void>;
  /** Get an execution run by ID */
  get: (runId: string) => Promise<ExecutionRun | null>;
  /** List executions for a flow */
  list: (flowId: string, options?: ListOptions) => Promise<ExecutionRun[]>;
  /** Update execution status */
  updateStatus: (runId: string, status: ExecutionStatus, data?: Partial<ExecutionRun>) => Promise<void>;
  /** Delete old executions */
  cleanup: (olderThan: Date) => Promise<number>;
}

/**
 * List options
 */
export interface ListOptions {
  status?: ExecutionStatus[];
  limit?: number;
  offset?: number;
  orderBy?: 'startedAt' | 'completedAt';
  order?: 'asc' | 'desc';
}
