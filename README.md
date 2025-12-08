# Noco

A monorepo for AI Agent-friendly database tools and utilities.

## Packages

| Package | Description |
|---------|-------------|
| [@workspace/agentdb](./packages/agentdb) | AI Agent-friendly PostgreSQL database layer with JSONB storage |
| [@workspace/platform-server](./packages/platform-server) | Low-code platform backend service with Express.js + AgentDB |
| [@workspace/flow-designer](./packages/flow-designer) | Flow designer core - graph management, nodes, edges, schema |
| [@workspace/flow-runtime](./packages/flow-runtime) | Flow runtime - execution engine, triggers, executors |
| [@workspace/flow-ui](./packages/flow) | Flow UI - React components for visual flow editing |

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or pnpm

### Installation

```bash
# Using npm
npm install

# Using pnpm
pnpm install
```

### Build

```bash
# Build all packages
npm run build

# Build a specific package
npm run build --workspace=@noco/agentdb
```

### Test

```bash
# Test all packages
npm run test

# Test a specific package
npm run test --workspace=@noco/agentdb
```

## Project Structure

```
noco/
├── packages/
│   ├── agentdb/          # AI Agent-friendly database layer
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── platform-server/  # Low-code platform backend
│   │   ├── src/
│   │   ├── docs/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── flow-designer/    # Flow designer core
│   │   ├── src/
│   │   │   ├── core/     # FlowGraph, Node, Edge
│   │   │   ├── registry/ # NodeRegistry
│   │   │   ├── types/    # Type definitions
│   │   │   └── utils/    # Serializer, Validator
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── flow-runtime/     # Flow execution engine
│   │   ├── src/
│   │   │   ├── engine/   # ExecutionEngine
│   │   │   ├── executors/ # ExecutorRegistry
│   │   │   ├── triggers/ # TriggerManager
│   │   │   └── types/    # Type definitions
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── flow/             # Flow UI (React components)
│       ├── src/
│       │   ├── components/
│       │   ├── model/
│       │   ├── render/
│       │   ├── setter/
│       │   ├── states/
│       │   └── lang/
│       ├── package.json
│       └── tsconfig.json
├── package.json          # Root workspace configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── tsconfig.json         # Root TypeScript configuration
```

## Development

This project uses npm workspaces (also compatible with pnpm workspaces) for managing multiple packages.

### Adding a new package

1. Create a new directory under `packages/`
2. Initialize with `npm init`
3. Configure TypeScript in `tsconfig.json`
4. The package will be automatically detected by the workspace

## License

MIT
