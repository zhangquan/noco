# AgentDB REST API

Professional, modular REST API for AgentDB.

## Directory Structure

```
rest-api/
├── index.ts                 # Main entry - exports all public APIs
├── router.ts                # Router factory functions
├── config.ts                # Configuration center
├── types/                   # Type definitions
│   ├── request.ts           # Request types (ApiRequest, RequestContext)
│   ├── response.ts          # Response types (PagedResponse, BulkResult)
│   └── params.ts            # Parameter types (ListParams, FilterObject)
├── middleware/              # Express middleware
│   ├── context.ts           # Database/user context injection
│   ├── auth.ts              # Authentication & authorization
│   ├── validation.ts        # Request validation
│   ├── error.ts             # Error handling
│   ├── rateLimit.ts         # Rate limiting
│   ├── cors.ts              # CORS handling
│   └── logging.ts           # Request logging
├── services/                # Business logic layer
│   ├── RecordService.ts     # Single record CRUD
│   ├── BulkService.ts       # Bulk operations
│   ├── RelationService.ts   # Link/unlink operations
│   └── ExportService.ts     # Data export (CSV/Excel)
├── handlers/                # Route handlers
│   ├── records.ts           # Record CRUD endpoints
│   ├── bulk.ts              # Bulk operation endpoints
│   ├── relations.ts         # Relation endpoints
│   ├── export.ts            # Export endpoints
│   └── public.ts            # Public/shared view endpoints
└── utils/                   # Utility functions
    ├── parser.ts            # Parameter parsing
    ├── response.ts          # Response builders
    └── serializer.ts        # Data serialization
```

## Quick Start

### Option 1: Full Setup

```typescript
import express from 'express';
import knex from 'knex';
import { createRestApi } from 'agentdb/rest-api';

const app = express();
const db = knex({ client: 'pg', connection: '...' });
const tables = [...]; // Your table definitions

app.use(express.json());
app.use(createRestApi({
  db,
  tables,
  basePath: '/api/v1/data',
  enablePublicApi: true,
  enableExportApi: true,
}));

app.listen(3000);
```

### Option 2: Manual Setup

```typescript
import express from 'express';
import { createDataRouter, createContextMiddleware } from 'agentdb/rest-api';

const app = express();
app.use(express.json());

// Add context middleware
app.use(createContextMiddleware(db, tables));

// Mount the data router
app.use('/api/v1/data', createDataRouter({
  enablePublicApi: true,
  enableExportApi: true,
}));

app.listen(3000);
```

## API Endpoints

### Records

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tables` | List all tables |
| GET | `/:tableName` | List records |
| POST | `/:tableName` | Create record |
| GET | `/:tableName/:rowId` | Get record |
| PATCH | `/:tableName/:rowId` | Update record |
| DELETE | `/:tableName/:rowId` | Delete record |
| GET | `/:tableName/:rowId/exists` | Check existence |
| GET | `/:tableName/find-one` | Find single record |
| GET | `/:tableName/count` | Count records |
| GET | `/:tableName/groupby` | Group by aggregation |
| GET | `/:tableName/schema` | Get schema description |

### Bulk Operations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bulk/:tableName` | Bulk insert |
| PATCH | `/bulk/:tableName` | Bulk update by IDs |
| PATCH | `/bulk/:tableName/all` | Bulk update by filter |
| DELETE | `/bulk/:tableName` | Bulk delete by IDs |
| DELETE | `/bulk/:tableName/all` | Bulk delete by filter |
| DELETE | `/bulk/:tableName/truncate` | Truncate table |
| POST | `/bulk/:tableName/write` | Mixed bulk operations |

### Relations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tableName/:rowId/links/:column` | List linked records |
| GET | `/:tableName/:rowId/links/:column/available` | List available records |
| POST | `/:tableName/:rowId/links/:column` | Link records |
| DELETE | `/:tableName/:rowId/links/:column` | Unlink records |

### Export

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tableName/export` | Export (format param) |
| GET | `/:tableName/export/csv` | Export as CSV |
| GET | `/:tableName/export/xlsx` | Export as Excel |
| POST | `/:tableName/export` | Export with options |

### Public/Shared Views

| Method | Path | Description |
|--------|------|-------------|
| GET | `/shared/:viewId` | List records |
| POST | `/shared/:viewId` | Create record |
| GET | `/shared/:viewId/:rowId` | Get record |

## Configuration

```typescript
import { setConfig } from 'agentdb/rest-api';

setConfig({
  // Pagination
  defaultPageSize: 25,
  maxPageSize: 1000,

  // Bulk operations
  maxBulkSize: 1000,
  bulkChunkSize: 100,

  // Export
  maxExportRows: 10000,
  exportTimeout: 30000,

  // Rate limiting
  enableRateLimit: true,
  rateLimitWindow: 60000,
  rateLimitMax: 100,

  // Auth
  allowAnonymousRead: true,
});
```

## Custom Authorization

```typescript
import { setPermissionChecker } from 'agentdb/rest-api';

setPermissionChecker(async (user, action, table) => {
  // Custom permission logic
  if (user.roles?.includes('admin')) return true;
  if (action === 'read') return true;
  return user.roles?.includes(`${table?.id}:${action}`);
});
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Record not found",
    "details": { "id": "xxx" }
  }
}
```

Error codes:
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `VALIDATION_ERROR` (422)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)

## Services

Services encapsulate business logic and can be used independently:

```typescript
import { RecordService, BulkService, RelationService, ExportService } from 'agentdb/rest-api';

// In a custom handler
const service = new RecordService(req.context);
const records = await service.list({ limit: 10 });
const record = await service.create({ name: 'Test' });
```
