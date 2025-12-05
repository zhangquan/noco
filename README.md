# Noco

A monorepo for AI Agent-friendly database tools and utilities.

## Packages

| Package | Description |
|---------|-------------|
| [@noco/agentdb](./packages/agentdb) | AI Agent-friendly PostgreSQL database layer with JSONB storage |

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
│   └── agentdb/          # AI Agent-friendly database layer
│       ├── src/
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
