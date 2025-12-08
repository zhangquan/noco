# @workspace/flow-runtime

Flow Runtime package for workflow execution and trigger handling.

## Overview

This package provides the runtime components for executing workflows:

- **ExecutionEngine**: Core engine for executing flow workflows
- **ExecutorRegistry**: Registry for node executors
- **TriggerManager**: Manages flow triggers (manual, schedule, webhook, record, form)

## Installation

```bash
pnpm add @workspace/flow-runtime
```

## Usage

### Basic Execution

```typescript
import { ExecutionEngine, TriggerManager } from '@workspace/flow-runtime';
import type { FlowSchema } from '@workspace/flow-designer';

// Create engine
const engine = new ExecutionEngine({
  maxConcurrent: 10,
  defaultTimeout: 300000, // 5 minutes
  debug: true,
});

// Start the engine
await engine.start();

// Execute a flow
const flowSchema: FlowSchema = {
  id: 'flow-1',
  name: 'My Flow',
  version: '1.0.0',
  triggerType: 'manual',
  nodes: [...],
  edges: [...],
};

const run = await engine.executeAndWait(
  flowSchema,
  {
    type: 'manual',
    source: 'user-123',
    timestamp: new Date(),
    payload: { type: 'manual', userId: 'user-123', inputs: { name: 'John' } }
  },
  { name: 'John' }
);

console.log('Run completed:', run.status);
console.log('Outputs:', run.outputs);

// Stop the engine
await engine.stop();
```

### Using Trigger Manager

```typescript
import { ExecutionEngine, TriggerManager } from '@workspace/flow-runtime';

const engine = new ExecutionEngine();
const triggerManager = new TriggerManager(engine);

await engine.start();
await triggerManager.init();

// Register a flow for triggering
await triggerManager.registerFlow(flowSchema);

// Manual trigger
const runId = await triggerManager.triggerManual('flow-1', { name: 'John' }, 'user-123');

// Webhook trigger
const runId = await triggerManager.handleWebhook(
  'POST',
  '/hooks/my-webhook',
  { 'content-type': 'application/json' },
  {},
  { data: 'payload' }
);

// Record event trigger
const runIds = await triggerManager.handleRecordEvent(
  'create',
  'table-1',
  'record-123',
  { name: 'New Record', value: 42 }
);

// Form submission trigger
const runId = await triggerManager.handleFormSubmission(
  'form-1',
  { field1: 'value1', field2: 'value2' },
  'user-123'
);

// Cleanup
await triggerManager.cleanup();
await engine.stop();
```

### Custom Node Executor

```typescript
import { ExecutorRegistry, NodeExecutor, NodeExecutorDef } from '@workspace/flow-runtime';

// Define custom executor
const myCustomExecutor: NodeExecutor = async (context, config) => {
  const input = context.getInput('Input');
  
  context.log('info', 'Processing custom node');
  
  // Do custom processing
  const result = await processData(input, config);
  
  context.setOutput('Result', result);
  context.setOutput('Success', true);
};

// Create executor definition
const customExecutorDef: NodeExecutorDef = {
  type: 'custom:my-node',
  execute: myCustomExecutor,
  validate: (config) => {
    if (!config.requiredField) {
      return { valid: false, errors: ['requiredField is missing'] };
    }
    return { valid: true, errors: [] };
  },
};

// Register with engine
const engine = new ExecutionEngine({
  customExecutors: [customExecutorDef],
});
```

### Subscribing to Events

```typescript
const engine = new ExecutionEngine();

// Subscribe to execution events
const unsubscribe = engine.subscribe((event) => {
  switch (event.type) {
    case 'execution:start':
      console.log(`Execution started: ${event.runId}`);
      break;
    case 'execution:complete':
      console.log(`Execution completed: ${event.runId}`);
      break;
    case 'execution:fail':
      console.log(`Execution failed: ${event.runId}`, event.data);
      break;
    case 'node:start':
      console.log(`Node started: ${event.nodeId}`);
      break;
    case 'node:complete':
      console.log(`Node completed: ${event.nodeId}`);
      break;
    case 'node:fail':
      console.log(`Node failed: ${event.nodeId}`, event.data);
      break;
  }
});

// Later: unsubscribe
unsubscribe();
```

## Execution Context

Node executors receive an `ExecutionContext` with these capabilities:

```typescript
interface ExecutionContext {
  // Current execution
  run: ExecutionRun;
  node: NodeData;
  
  // Variables
  getVariable(name: string): unknown;
  setVariable(name: string, value: unknown): void;
  
  // Logging
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void;
  
  // I/O
  getInput(portId: string): unknown;
  setOutput(portId: string, value: unknown): void;
  
  // Child execution
  executeChild(nodeId: string, inputs?: Record<string, unknown>): Promise<Record<string, unknown>>;
  
  // Control
  cancel(reason?: string): void;
  isCancelled(): boolean;
  sleep(ms: number): Promise<void>;
  
  // External services
  http: HttpClient;
  env: Record<string, string>;
  project: ProjectContext;
}
```

## Built-in Executors

### Triggers
- `trigger:manual` - Manual trigger entry point
- `trigger:schedule` - Scheduled/cron trigger
- `trigger:webhook` - HTTP webhook trigger
- `trigger:record` - Database record event trigger
- `trigger:form` - Form submission trigger

### Logic
- `logic:condition` - Conditional branching
- `logic:switch` - Multi-path switch
- `logic:loop` - Iteration over items

### Actions
- `action:http` - HTTP requests
- `action:query` - Database queries
- `action:create` - Create records
- `action:update` - Update records
- `action:delete` - Delete records
- `action:script` - Custom JavaScript execution

### Integrations
- `integration:email` - Send emails

### Utilities
- `utility:delay` - Wait/delay
- `utility:log` - Log messages

## Engine Configuration

```typescript
interface EngineConfig {
  // Maximum concurrent executions
  maxConcurrent?: number; // default: 10
  
  // Default execution timeout in ms
  defaultTimeout?: number; // default: 300000 (5 min)
  
  // Enable debug logging
  debug?: boolean; // default: false
  
  // Retry configuration
  retry?: {
    maxAttempts: number;
    delay: number;
    backoffMultiplier?: number;
  };
  
  // Custom node executors
  customExecutors?: NodeExecutorDef[];
}
```

## License

MIT
