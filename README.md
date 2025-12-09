# Noco

A monorepo for AI Agent-friendly database tools and utilities.

## Packages

| Package | Description |
|---------|-------------|
| [@workspace/agentdb](./packages/agentdb) | AI Agent-friendly PostgreSQL database layer with JSONB storage |
| [@workspace/platform-server](./packages/platform-server) | Low-code platform backend service with Express.js + AgentDB |
| [@workspace/flow-designer](./packages/flow-designer) | Flow designer - core engine + React UI for visual flow editing |
| [@workspace/flow-runtime](./packages/flow-runtime) | Flow runtime - execution engine, triggers, executors |
| [@workspace/flex-parser](./packages/flex-parser) | Convert absolute positioning design schema to CSS Flex layout |
| [@workspace/code2vision](./packages/code2vision) | TSX code visualization and manipulation tool (planning) |

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
│   ├── flow-designer/    # Flow designer (core + UI)
│   │   ├── src/
│   │   │   ├── core/     # FlowGraph, Node, Edge
│   │   │   ├── registry/ # NodeRegistry
│   │   │   ├── components/ # React node components
│   │   │   ├── model/    # UI data model
│   │   │   ├── render/   # Flow rendering
│   │   │   ├── setter/   # Property setters
│   │   │   ├── states/   # State management
│   │   │   ├── utils/    # Serializer, Validator
│   │   │   └── lang/     # i18n
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
│   ├── flex-parser/      # Design to Flex layout converter
│   │   ├── src/
│   │   │   ├── layout/   # Layout algorithms
│   │   │   └── utils/    # Utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── code2vision/      # TSX code visualization (planning)
│       ├── FEASIBILITY_STUDY.md  # Technical proposal
│       └── README.md
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
