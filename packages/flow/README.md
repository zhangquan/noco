# @workspace/flow

FlowSDK - A React-based workflow/logic flow editor and runtime framework.

## Features

- **Design Time**: Visual flow editor for creating and editing workflows
- **Runtime**: Execute workflow logic with expression evaluation
- **TypeScript**: Full type safety with comprehensive type definitions
- **Internationalization**: Support for 32+ languages
- **Extensible**: Register custom node types and executors

## Installation

```bash
npm install @workspace/flow
# or
pnpm add @workspace/flow
```

## Quick Start

```tsx
import { FlowDesigner } from '@workspace/flow';
import '@workspace/flow/style.css';

function App() {
  return (
    <FlowDesigner
      onSchemaChange={(schema) => console.log('Schema changed:', schema)}
      onSave={async (schema) => {
        // Save schema to your backend
      }}
    />
  );
}
```

## Architecture

### Directory Structure

```
packages/flow/src/
├── index.ts              # Main entry point
├── designer.tsx          # FlowDesigner component
├── types.ts              # TypeScript definitions
├── components/           # Node components
│   ├── nodes/            # Node components
│   └── plusNodes/        # Add node components
├── model/                # Data model layer
├── render/               # Flow rendering
├── runtime/              # Execution engine
├── setter/               # Property setters
├── states/               # State management
├── lang/                 # i18n files
└── utils/                # Utilities
```

### Flow Schema

A flow schema consists of nodes organized in a tree structure:

```typescript
interface FlowSchemaType {
  id: string;
  actionType: 'event';
  props?: {
    title?: string;
    eventType?: FlowEventTypes;
    tableId?: string;
  };
  actions?: FlowNodeType[];
}
```

### Node Types

- `event` - Event trigger (root node)
- `dataList` - Query data from table
- `dataInsert` - Insert new record
- `dataUpdate` - Update existing record
- `dataDelete` - Delete record
- `if` - Conditional branching
- `condition` - Condition branch
- `var` - Variable operations
- `fn` - Function execution
- `loop` - Iterate over data
- `message` - Show notification

## API Reference

### FlowDesigner

Main designer component.

```tsx
<FlowDesigner
  schema={initialSchema}          // Initial flow schema
  flowId="flow-123"               // Flow ID
  readonly={false}                // Read-only mode
  tables={[]}                     // Available tables
  views={{}}                      // Views by table
  fields={{}}                     // Fields by table
  locale="en"                     // Locale
  onSchemaChange={handler}        // Schema change callback
  onNodeSelect={handler}          // Node selection callback
  onSave={handler}                // Save callback
  onPublish={handler}             // Publish callback
/>
```

### Runtime Execution

Execute a flow schema:

```typescript
import { invokeFlow } from '@workspace/flow';

const result = await invokeFlow(schema, {
  eventData: { id: 1, name: 'Test' },
  dataApi: {
    list: async (params) => { /* fetch data */ },
    insert: async (params) => { /* insert data */ },
    update: async (params) => { /* update data */ },
    delete: async (params) => { /* delete data */ },
  },
});

console.log(result.success, result.data);
```

### State Management

Using Zustand store:

```typescript
import { useFlowSchemaStore } from '@workspace/flow';

function MyComponent() {
  const { schema, selectedNodeId, addNode, removeNode } = useFlowSchemaStore();
  
  // ...
}
```

### Custom Node Registration

Register custom node types:

```typescript
import { nodeRegistry, registerNodeExecutor } from '@workspace/flow';

nodeRegistry.register({
  type: 'customNode',
  name: 'Custom Node',
  description: 'A custom node type',
  icon: <CustomIcon />,
  category: 'custom',
  defaultProps: { title: 'Custom' },
});

registerNodeExecutor('customNode', async (node, context, props) => {
  // Custom execution logic
  return result;
});
```

## Expression Syntax

Expressions use `{variable.path}` syntax:

```typescript
// Access event data
"{eventData.id}"

// Access flow data from previous node
"{flowData.nodeId.field}"

// Access loop data
"{loopData.item.name}"

// Math operations
"{eventData.quantity} * {eventData.price}"

// Comparison
"{eventData.status} === 'active'"
```

## Internationalization

Initialize with a locale:

```typescript
import { initI18n } from '@workspace/flow';

initI18n('zh_CN'); // Chinese
initI18n('en');    // English (default)
```

## License

MIT
