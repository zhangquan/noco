# @workspace/flow-designer

Flow Designer package for visual workflow design and schema management.

## Overview

This package provides the design-time components for building visual workflows:

- **FlowGraph**: Main class for managing flow graphs with nodes and edges
- **Node**: Represents a single node in the flow
- **Edge**: Represents a connection between nodes
- **NodeRegistry**: Registry for built-in and custom node definitions
- **Validator**: Schema validation utilities
- **Serializer**: Serialization/deserialization utilities

## Installation

```bash
pnpm add @workspace/flow-designer
```

## Usage

### Creating a Flow

```typescript
import { FlowGraph, Node, Edge } from '@workspace/flow-designer';

// Create a new flow
const flow = FlowGraph.create('My Workflow', 'manual');

// Add nodes
const triggerNode = new Node({ type: 'trigger:manual' });
flow.addNode(triggerNode);

const httpNode = new Node({ 
  type: 'action:http',
  config: { url: 'https://api.example.com/data', method: 'GET' }
});
flow.addNode(httpNode);

// Connect nodes
flow.connect(
  triggerNode.id, 'Output',
  httpNode.id, 'Input'
);

// Validate the flow
const result = flow.validate();
console.log(result);

// Serialize to JSON
const json = flow.toJSON();
```

### Using Node Registry

```typescript
import { NodeRegistry, defaultRegistry } from '@workspace/flow-designer';

// Get all trigger nodes
const triggers = defaultRegistry.getTriggers();

// Search for nodes
const httpNodes = defaultRegistry.search('http');

// Register custom node
defaultRegistry.register({
  type: 'custom:my-node',
  category: 'action',
  name: 'My Custom Node',
  description: 'Does something custom',
  defaultLabel: 'Custom Node',
  inputs: [{ label: 'Input', direction: 'input', dataType: 'any' }],
  outputs: [{ label: 'Output', direction: 'output', dataType: 'any' }],
  defaultConfig: {},
  version: '1.0.0',
});
```

### Serialization

```typescript
import { 
  serializeFlow, 
  deserializeFlow,
  exportFlow,
  importFlow 
} from '@workspace/flow-designer';

// Serialize flow to JSON string
const json = serializeFlow(flow, { pretty: true });

// Deserialize flow from JSON
const loadedFlow = deserializeFlow(json);

// Export for file download
const { content, filename } = exportFlow(flow);

// Import from file content
const importedFlow = importFlow(fileContent);
```

## Node Types

### Triggers
- `trigger:manual` - Manual trigger
- `trigger:schedule` - Schedule/cron trigger
- `trigger:webhook` - Webhook trigger
- `trigger:record` - Record event trigger
- `trigger:form` - Form submission trigger

### Logic
- `logic:condition` - If/else branching
- `logic:switch` - Multi-branch switch
- `logic:loop` - Iteration/loop

### Actions
- `action:http` - HTTP request
- `action:query` - Query database
- `action:create` - Create record
- `action:update` - Update record
- `action:delete` - Delete record
- `action:script` - Custom script

### Integrations
- `integration:email` - Send email
- `integration:sms` - Send SMS
- `integration:notification` - Send notification

### Utilities
- `utility:delay` - Delay/wait
- `utility:log` - Log message
- `utility:comment` - Comment (no-op)

## API Reference

### FlowGraph

```typescript
class FlowGraph {
  // Properties
  id: string;
  name: string;
  description?: string;
  triggerType: FlowTriggerType;
  
  // Node operations
  addNode(node: Node | NodeData): Node;
  getNode(id: string): Node | undefined;
  removeNode(id: string): boolean;
  moveNode(id: string, x: number, y: number): boolean;
  
  // Edge operations
  addEdge(edge: Edge | EdgeData): Edge;
  connect(sourceId, sourcePort, targetId, targetPort): Edge;
  removeEdge(id: string): boolean;
  
  // Graph analysis
  getTopologicalOrder(): Node[];
  isDAG(): boolean;
  validate(): FlowValidationResult;
  
  // Serialization
  toSchema(): FlowSchema;
  toJSON(): string;
  clone(newName?: string): FlowGraph;
}
```

### Node

```typescript
class Node {
  id: string;
  type: NodeType;
  category: NodeCategory;
  label: string;
  position: NodePosition;
  inputs: NodePort[];
  outputs: NodePort[];
  config: NodeConfig;
  
  moveTo(x: number, y: number): void;
  updateConfig(config: Partial<NodeConfig>): void;
  validate(): NodeValidationResult;
  clone(position?: NodePosition): Node;
  toJSON(): NodeData;
}
```

### Edge

```typescript
class Edge {
  id: string;
  sourceId: string;
  sourcePort: string;
  targetId: string;
  targetPort: string;
  type: EdgeType;
  
  setCondition(condition: string): void;
  validate(): { valid: boolean; errors: string[] };
  clone(): Edge;
  toJSON(): EdgeData;
}
```

## License

MIT
