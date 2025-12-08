/**
 * Flow Execution Engine
 * Core engine for executing flow workflows
 * @module flow-runtime/engine/ExecutionEngine
 */

import { ulid } from 'ulid';
import type { FlowSchema, NodeData, EdgeData } from '@workspace/flow-designer';
import type {
  ExecutionRun,
  ExecutionStatus,
  ExecutionPriority,
  ExecutionContext,
  ExecutionError,
  ExecutionLog,
  NodeExecutionState,
  NodeExecutionStatus,
  TriggerData,
  EngineConfig,
  EngineStatus,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionEventListener,
  NodeExecutor,
  NodeExecutorDef,
  HttpClient,
  ProjectContext,
} from '../types/index.js';
import { ExecutorRegistry } from '../executors/ExecutorRegistry.js';

// ============================================================================
// Execution Engine
// ============================================================================

/**
 * Flow execution engine - executes flow workflows
 */
export class ExecutionEngine {
  private config: Required<EngineConfig>;
  private executorRegistry: ExecutorRegistry;
  private activeRuns: Map<string, ExecutionRun>;
  private executionQueue: ExecutionRun[];
  private listeners: Set<ExecutionEventListener>;
  private running: boolean;
  private stats: {
    totalExecutions: number;
    failedExecutions: number;
    totalTime: number;
  };

  constructor(config: EngineConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 10,
      defaultTimeout: config.defaultTimeout ?? 300000, // 5 minutes
      debug: config.debug ?? false,
      retry: config.retry ?? {
        maxAttempts: 3,
        delay: 1000,
        backoffMultiplier: 2,
      },
      customExecutors: config.customExecutors ?? [],
    };

    this.executorRegistry = new ExecutorRegistry();
    this.activeRuns = new Map();
    this.executionQueue = [];
    this.listeners = new Set();
    this.running = false;
    this.stats = {
      totalExecutions: 0,
      failedExecutions: 0,
      totalTime: 0,
    };

    // Register custom executors
    for (const executor of this.config.customExecutors) {
      this.executorRegistry.register(executor);
    }
  }

  // ==========================================================================
  // Engine Lifecycle
  // ==========================================================================

  /**
   * Start the engine
   */
  async start(): Promise<void> {
    if (this.running) return;
    
    this.running = true;
    this.debug('Engine started');

    // Initialize all executors
    await this.executorRegistry.initAll();

    // Process queue
    this.processQueue();
  }

  /**
   * Stop the engine
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.debug('Engine stopping...');

    // Cancel all active runs
    for (const run of this.activeRuns.values()) {
      await this.cancelExecution(run.id, 'Engine shutdown');
    }

    // Cleanup executors
    await this.executorRegistry.cleanupAll();

    this.debug('Engine stopped');
  }

  /**
   * Get engine status
   */
  getStatus(): EngineStatus {
    const avgTime = this.stats.totalExecutions > 0
      ? this.stats.totalTime / this.stats.totalExecutions
      : 0;

    return {
      running: this.running,
      activeExecutions: this.activeRuns.size,
      queuedExecutions: this.executionQueue.length,
      totalExecutions: this.stats.totalExecutions,
      failedExecutions: this.stats.failedExecutions,
      avgExecutionTime: avgTime,
    };
  }

  // ==========================================================================
  // Execution Methods
  // ==========================================================================

  /**
   * Execute a flow
   */
  async execute(
    flowSchema: FlowSchema,
    triggerData: TriggerData,
    inputs: Record<string, unknown> = {},
    options: { priority?: ExecutionPriority; parentRunId?: string } = {}
  ): Promise<ExecutionRun> {
    const run = this.createRun(flowSchema, triggerData, inputs, options);

    // Add to queue
    this.executionQueue.push(run);
    this.sortQueue();

    // Process queue
    this.processQueue();

    return run;
  }

  /**
   * Execute a flow and wait for completion
   */
  async executeAndWait(
    flowSchema: FlowSchema,
    triggerData: TriggerData,
    inputs: Record<string, unknown> = {},
    options: { priority?: ExecutionPriority; timeout?: number } = {}
  ): Promise<ExecutionRun> {
    const run = await this.execute(flowSchema, triggerData, inputs, options);
    
    return new Promise((resolve, reject) => {
      const timeout = options.timeout ?? this.config.defaultTimeout;
      const timeoutId = setTimeout(() => {
        this.cancelExecution(run.id, 'Timeout');
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      const unsubscribe = this.subscribe((event) => {
        if (event.runId === run.id) {
          if (event.type === 'execution:complete' || 
              event.type === 'execution:fail' || 
              event.type === 'execution:cancel') {
            clearTimeout(timeoutId);
            unsubscribe();
            const updatedRun = this.activeRuns.get(run.id) || run;
            resolve(updatedRun);
          }
        }
      });
    });
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(runId: string, reason?: string): Promise<boolean> {
    const run = this.activeRuns.get(runId);
    if (!run) return false;

    run.status = 'cancelled';
    run.completedAt = new Date();
    run.duration = run.completedAt.getTime() - run.startedAt.getTime();
    run.error = {
      code: 'CANCELLED',
      message: reason || 'Execution cancelled',
    };

    this.emit('execution:cancel', runId, { reason });
    this.activeRuns.delete(runId);

    return true;
  }

  /**
   * Get an active run
   */
  getRun(runId: string): ExecutionRun | undefined {
    return this.activeRuns.get(runId);
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Subscribe to execution events
   */
  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(type: ExecutionEventType, runId: string, data?: unknown, nodeId?: string): void {
    const event: ExecutionEvent = {
      type,
      runId,
      nodeId,
      timestamp: new Date(),
      data,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in execution event listener:', error);
      }
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create a new execution run
   */
  private createRun(
    flowSchema: FlowSchema,
    triggerData: TriggerData,
    inputs: Record<string, unknown>,
    options: { priority?: ExecutionPriority; parentRunId?: string }
  ): ExecutionRun {
    const nodeStates = new Map<string, NodeExecutionState>();
    
    for (const node of flowSchema.nodes) {
      nodeStates.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        inputs: {},
        outputs: {},
        retryCount: 0,
        logs: [],
      });
    }

    return {
      id: ulid(),
      flowId: flowSchema.id,
      flowSchema,
      status: 'pending',
      priority: options.priority ?? 'normal',
      triggerData,
      inputs,
      nodeStates,
      variables: new Map(),
      startedAt: new Date(),
      retryCount: 0,
      parentRunId: options.parentRunId,
    };
  }

  /**
   * Sort execution queue by priority
   */
  private sortQueue(): void {
    const priorityOrder: Record<ExecutionPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    this.executionQueue.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Process the execution queue
   */
  private processQueue(): void {
    if (!this.running) return;

    while (
      this.executionQueue.length > 0 &&
      this.activeRuns.size < this.config.maxConcurrent
    ) {
      const run = this.executionQueue.shift()!;
      this.activeRuns.set(run.id, run);
      this.executeRun(run).catch(error => {
        console.error('Execution error:', error);
      });
    }
  }

  /**
   * Execute a single run
   */
  private async executeRun(run: ExecutionRun): Promise<void> {
    this.debug(`Starting execution: ${run.id}`);
    
    run.status = 'running';
    run.startedAt = new Date();
    this.stats.totalExecutions++;
    
    this.emit('execution:start', run.id, { flowId: run.flowId });

    try {
      // Get topological order of nodes
      const order = this.getTopologicalOrder(run.flowSchema);
      
      // Find trigger node
      const triggerNode = this.findTriggerNode(run.flowSchema);
      if (!triggerNode) {
        throw new Error('No trigger node found in flow');
      }

      // Set trigger outputs from trigger data
      const triggerState = run.nodeStates.get(triggerNode.id)!;
      triggerState.outputs = this.extractTriggerOutputs(run.triggerData);
      triggerState.status = 'completed';

      // Execute nodes in order
      for (const node of order) {
        if (node.id === triggerNode.id) continue; // Skip trigger
        if (node.disabled) continue; // Skip disabled nodes

        // Check if cancelled
        if (run.status !== 'running') break;

        // Check if node should be executed (all predecessors completed)
        if (!this.shouldExecuteNode(run, node)) {
          const state = run.nodeStates.get(node.id)!;
          state.status = 'skipped';
          this.emit('node:skip', run.id, { nodeId: node.id }, node.id);
          continue;
        }

        // Execute node
        await this.executeNode(run, node);
      }

      // Mark as completed
      if (run.status === 'running') {
        run.status = 'completed';
        run.completedAt = new Date();
        run.duration = run.completedAt.getTime() - run.startedAt.getTime();
        run.outputs = this.collectOutputs(run);
        
        this.stats.totalTime += run.duration;
        this.emit('execution:complete', run.id, { duration: run.duration, outputs: run.outputs });
      }
    } catch (error) {
      run.status = 'failed';
      run.completedAt = new Date();
      run.duration = run.completedAt.getTime() - run.startedAt.getTime();
      run.error = this.createError(error);
      
      this.stats.failedExecutions++;
      this.stats.totalTime += run.duration;
      this.emit('execution:fail', run.id, { error: run.error });
    } finally {
      this.activeRuns.delete(run.id);
      this.processQueue();
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(run: ExecutionRun, node: NodeData): Promise<void> {
    const state = run.nodeStates.get(node.id)!;
    
    this.debug(`Executing node: ${node.id} (${node.type})`);
    
    state.status = 'running';
    state.startedAt = new Date();
    this.emit('node:start', run.id, { nodeId: node.id, type: node.type }, node.id);

    try {
      // Get inputs from predecessor outputs
      state.inputs = this.collectNodeInputs(run, node);

      // Create execution context
      const context = this.createContext(run, node, state);

      // Get executor
      const executor = this.executorRegistry.get(node.type);
      if (!executor) {
        throw new Error(`No executor found for node type: ${node.type}`);
      }

      // Execute with timeout
      const timeout = run.flowSchema.settings?.timeout ?? this.config.defaultTimeout;
      await Promise.race([
        executor.execute(context, node.config),
        this.timeout(timeout),
      ]);

      // Mark as completed
      state.status = 'completed';
      state.completedAt = new Date();
      state.duration = state.completedAt.getTime() - (state.startedAt?.getTime() ?? 0);
      
      this.emit('node:complete', run.id, { 
        nodeId: node.id, 
        outputs: state.outputs,
        duration: state.duration,
      }, node.id);
    } catch (error) {
      state.status = 'failed';
      state.completedAt = new Date();
      state.duration = state.completedAt.getTime() - (state.startedAt?.getTime() ?? 0);
      state.error = this.createError(error, node.id);

      this.emit('node:fail', run.id, { 
        nodeId: node.id, 
        error: state.error,
      }, node.id);

      // Check if we should continue on error
      const continueOnError = run.flowSchema.settings?.errorHandling?.continueOnError;
      if (!continueOnError) {
        throw error;
      }
    }
  }

  /**
   * Create execution context for a node
   */
  private createContext(
    run: ExecutionRun,
    node: NodeData,
    state: NodeExecutionState
  ): ExecutionContext {
    let cancelled = false;

    return {
      run,
      node,
      getVariable: (name: string) => run.variables.get(name),
      setVariable: (name: string, value: unknown) => run.variables.set(name, value),
      log: (level, message, data) => {
        const logEntry: ExecutionLog = {
          level,
          message,
          timestamp: new Date(),
          nodeId: node.id,
          data,
        };
        state.logs.push(logEntry);
        if (this.config.debug || level === 'error') {
          console[level](`[${run.id}/${node.id}]`, message, data ?? '');
        }
      },
      getInput: (portId: string) => state.inputs[portId],
      setOutput: (portId: string, value: unknown) => {
        state.outputs[portId] = value;
      },
      executeChild: async (nodeId: string, inputs?: Record<string, unknown>) => {
        const childNode = run.flowSchema.nodes.find(n => n.id === nodeId);
        if (!childNode) throw new Error(`Node not found: ${nodeId}`);
        
        const childState = run.nodeStates.get(nodeId)!;
        if (inputs) {
          childState.inputs = { ...childState.inputs, ...inputs };
        }
        
        await this.executeNode(run, childNode);
        return childState.outputs;
      },
      cancel: (reason?: string) => {
        cancelled = true;
        this.cancelExecution(run.id, reason);
      },
      isCancelled: () => cancelled || run.status === 'cancelled',
      sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
      http: this.createHttpClient(),
      env: process.env as Record<string, string>,
      project: this.createProjectContext(run),
    };
  }

  /**
   * Create HTTP client
   */
  private createHttpClient(): HttpClient {
    // This is a placeholder - in production, use a proper HTTP client
    return {
      get: async (url, options) => this.httpRequest({ ...options, method: 'GET', url }),
      post: async (url, body, options) => this.httpRequest({ ...options, method: 'POST', url, body }),
      put: async (url, body, options) => this.httpRequest({ ...options, method: 'PUT', url, body }),
      patch: async (url, body, options) => this.httpRequest({ ...options, method: 'PATCH', url, body }),
      delete: async (url, options) => this.httpRequest({ ...options, method: 'DELETE', url }),
      request: async (options) => this.httpRequest(options),
    };
  }

  /**
   * Make HTTP request
   */
  private async httpRequest(options: { 
    method?: string; 
    url?: string; 
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  }): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: unknown; ok: boolean }> {
    const { method = 'GET', url, headers = {}, body, timeout = 30000 } = options;
    
    if (!url) throw new Error('URL is required');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        ok: response.ok,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Create project context
   */
  private createProjectContext(run: ExecutionRun): ProjectContext {
    // This is a placeholder - should be injected with actual project operations
    return {
      id: run.flowSchema.meta?.projectId as string || '',
      name: run.flowSchema.meta?.projectName as string || '',
      query: async () => ({ records: [], total: 0, offset: 0, limit: 0 }),
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => true,
      getById: async () => null,
    };
  }

  /**
   * Get topological order of nodes
   */
  private getTopologicalOrder(schema: FlowSchema): NodeData[] {
    const result: NodeData[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const adjacencyList = new Map<string, string[]>();
    for (const node of schema.nodes) {
      adjacencyList.set(node.id, []);
    }
    for (const edge of schema.edges) {
      const list = adjacencyList.get(edge.sourceId);
      if (list) {
        list.push(edge.targetId);
      }
    }

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      if (temp.has(nodeId)) throw new Error('Cycle detected in flow');

      temp.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      
      const node = schema.nodes.find(n => n.id === nodeId);
      if (node) result.unshift(node);
    };

    for (const node of schema.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return result;
  }

  /**
   * Find trigger node
   */
  private findTriggerNode(schema: FlowSchema): NodeData | undefined {
    if (schema.triggerNodeId) {
      return schema.nodes.find(n => n.id === schema.triggerNodeId);
    }
    return schema.nodes.find(n => n.category === 'trigger');
  }

  /**
   * Check if node should be executed
   */
  private shouldExecuteNode(run: ExecutionRun, node: NodeData): boolean {
    const incomingEdges = run.flowSchema.edges.filter(e => e.targetId === node.id);
    
    if (incomingEdges.length === 0) {
      // No incoming edges - this is a trigger or disconnected node
      return node.category === 'trigger';
    }

    // Check if at least one predecessor completed successfully
    return incomingEdges.some(edge => {
      const sourceState = run.nodeStates.get(edge.sourceId);
      return sourceState?.status === 'completed';
    });
  }

  /**
   * Collect inputs for a node from predecessor outputs
   */
  private collectNodeInputs(run: ExecutionRun, node: NodeData): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = run.flowSchema.edges.filter(e => e.targetId === node.id);

    for (const edge of incomingEdges) {
      const sourceState = run.nodeStates.get(edge.sourceId);
      if (sourceState?.status === 'completed') {
        const outputValue = sourceState.outputs[edge.sourcePort];
        if (outputValue !== undefined) {
          inputs[edge.targetPort] = outputValue;
        }
      }
    }

    return inputs;
  }

  /**
   * Extract outputs from trigger data
   */
  private extractTriggerOutputs(triggerData: TriggerData): Record<string, unknown> {
    return {
      data: triggerData.payload,
      timestamp: triggerData.timestamp,
      source: triggerData.source,
      type: triggerData.type,
    };
  }

  /**
   * Collect final outputs from the flow
   */
  private collectOutputs(run: ExecutionRun): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    
    // Collect from output nodes (nodes with no outgoing edges)
    const terminalNodes = run.flowSchema.nodes.filter(node => {
      const hasOutgoing = run.flowSchema.edges.some(e => e.sourceId === node.id);
      return !hasOutgoing && node.category !== 'trigger';
    });

    for (const node of terminalNodes) {
      const state = run.nodeStates.get(node.id);
      if (state?.status === 'completed') {
        outputs[node.id] = state.outputs;
      }
    }

    return outputs;
  }

  /**
   * Create error object
   */
  private createError(error: unknown, nodeId?: string): ExecutionError {
    if (error instanceof Error) {
      return {
        code: 'EXECUTION_ERROR',
        message: error.message,
        stack: error.stack,
        nodeId,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      nodeId,
    };
  }

  /**
   * Create timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Debug log
   */
  private debug(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.debug(`[ExecutionEngine]`, message, ...args);
    }
  }
}

export default ExecutionEngine;
