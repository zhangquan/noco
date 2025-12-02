# JSONB Model

A flexible, extensible database abstraction layer for PostgreSQL with JSONB storage using **composition pattern**.

## Features

- 🚀 **High Performance**: Optimized for PostgreSQL with JSONB storage and GIN indexes
- 📦 **Composition Pattern**: Modular operations that can be combined flexibly
- 🔗 **Relationship Support**: Full many-to-many relationship operations
- 🧮 **Virtual Columns**: Support for Formula, Rollup, Lookup, and Links columns
- 📋 **Bulk Operations**: Efficient batch insert, update, and delete
- 🔄 **Lazy Loading**: Optional lazy loading for related records
- 📝 **Copy Operations**: Deep copy records with relationships

## Installation

```bash
npm install jsonb-model
```

## Quick Start

```typescript
import { createModel, initDatabase } from 'jsonb-model';
import knex from 'knex';

// Setup database connection
const db = knex({
  client: 'pg',
  connection: 'postgresql://localhost/mydb',
});

// Initialize database schema
await initDatabase(db);

// Define your table schema
const tables = [
  {
    id: 'users',
    title: 'Users',
    columns: [
      { id: 'name', title: 'Name', uidt: 'SingleLineText' },
      { id: 'email', title: 'Email', uidt: 'Email' },
    ],
  },
];

// Create a model instance
const model = createModel({
  db,
  tableId: 'users',
  tables,
});

// CRUD operations
const user = await model.insert({ name: 'John', email: 'john@example.com' });
const users = await model.list({ limit: 10 });
await model.updateByPk(user.id, { name: 'Jane' });
await model.deleteByPk(user.id);
```

## Architecture: Composition Pattern

The model uses composition instead of inheritance. Each capability is a separate operation module that can be enabled or disabled:

```typescript
// Model with all features
const fullModel = createFullModel({ db, tableId, tables });

// Minimal model (only CRUD)
const minimalModel = createMinimalModel({ db, tableId, tables });

// Custom composition
const customModel = new Model({
  db, tableId, tables
}, {
  virtualColumns: true,
  linkOperations: true,
  lazyLoading: false,
  copyOperations: true,
});
```

### Operation Modules

| Module | Description | Access |
|--------|-------------|--------|
| `CrudOperations` | Basic CRUD operations | Always included |
| `LinkOperations` | Many-to-many relationships | `model.links` |
| `VirtualColumnOperations` | Formula, Rollup, Lookup | `model.virtual` |
| `LazyOperations` | Lazy loading | `model.lazy` |
| `CopyOperations` | Record duplication | `model.copy` |

## Project Structure

```
src/
├── config/          # Configuration and constants
│   └── index.ts     # TABLE_DATA, TABLE_RELATIONS, pagination defaults
├── types/           # Type definitions
│   ├── column.ts    # Column, UITypes, relation types
│   ├── table.ts     # Table, View definitions
│   ├── filter.ts    # Filter, Sort types
│   ├── query.ts     # ListArgs, BulkOptions, Record
│   └── index.ts     # Barrel export
├── core/            # Core abstractions
│   ├── ModelContext.ts   # Shared state for operations
│   ├── NcError.ts        # Error handling
│   ├── operations/       # Operation modules
│   │   ├── CrudOperations.ts       # CRUD
│   │   ├── LinkOperations.ts       # Many-to-many
│   │   ├── VirtualColumnOperations.ts  # Virtual columns
│   │   ├── LazyOperations.ts       # Lazy loading
│   │   ├── CopyOperations.ts       # Deep copy
│   │   └── index.ts
│   └── index.ts
├── models/          # Model composition
│   ├── Model.ts     # Main model composing operations
│   └── index.ts
├── query/           # Query building
│   ├── sqlBuilder.ts      # SQL expression helpers
│   ├── conditionBuilder.ts  # Filter conditions
│   ├── sortBuilder.ts      # Sort handling
│   ├── formulaBuilder.ts   # Formula evaluation
│   ├── rollupBuilder.ts    # Rollup aggregations
│   ├── linkBuilder.ts      # Link count queries
│   └── index.ts
├── functions/       # SQL function mappings
│   ├── common.ts    # Common functions (IF, AND, OR, etc.)
│   ├── postgres.ts  # PostgreSQL-specific functions
│   └── index.ts
├── utils/           # Utilities
│   ├── sanitize.ts    # Input sanitization (XSS prevention)
│   ├── columnUtils.ts # Column helpers
│   └── index.ts
└── index.ts         # Main entry point
```

## API Reference

### Factory Functions

#### `createModel(params)`

Create a model with default options (virtual columns + links).

```typescript
const model = createModel({
  db: knex,
  tableId: 'users',
  tables: allTables,
});
```

#### `createLazyModel(params)`

Create a model with lazy loading enabled.

```typescript
const model = createLazyModel({ db, tableId, tables });

// Load with relations
const records = await model.lazy?.listWithRelations({ limit: 10 });
```

#### `createCopyModel(params)`

Create a model with copy operations enabled.

```typescript
const model = createCopyModel({ db, tableId, tables });

// Deep copy a record
const copy = await model.copy?.copyRecordDeep('record_id', { deepCopy: true });
```

#### `createFullModel(params)`

Create a model with all features enabled.

#### `createMinimalModel(params)`

Create a minimal model with only CRUD operations.

### CRUD Operations

```typescript
// Read
const record = await model.readByPk('record_id');
const exists = await model.exists('record_id');
const found = await model.findOne({ where: 'name,eq,John' });

// List
const records = await model.list({
  fields: ['name', 'email'],
  filterArr: [{ fk_column_id: 'name', comparison_op: 'like', value: 'John' }],
  sortArr: [{ fk_column_id: 'name', direction: 'asc' }],
  limit: 10,
  offset: 0,
});

// Count
const total = await model.count({ filterArr: [...] });

// Insert
const newRecord = await model.insert({ name: 'John', email: 'john@example.com' });

// Update
const updated = await model.updateByPk('record_id', { name: 'Jane' });

// Delete
await model.deleteByPk('record_id');
```

### Bulk Operations

```typescript
// Bulk insert
const records = await model.bulkInsert([
  { name: 'User 1' },
  { name: 'User 2' },
], { chunkSize: 100 });

// Bulk update
await model.bulkUpdate([
  { id: 'id1', name: 'Updated 1' },
  { id: 'id2', name: 'Updated 2' },
]);

// Bulk delete
await model.bulkDelete(['id1', 'id2', 'id3']);
```

### Link Operations (Many-to-Many)

```typescript
// Access link operations via model.links
const linkOps = model.links;

// List linked records
const linked = await linkOps.mmList(column, { parentId: 'parent_id' });

// Count linked records
const count = await linkOps.mmListCount(column, { parentId: 'parent_id' });

// Link records
await linkOps.mmLink(column, ['child_id_1', 'child_id_2'], 'parent_id');

// Unlink records
await linkOps.mmUnlink(column, ['child_id_1'], 'parent_id');

// List excluded (unlinked) records
const excluded = await linkOps.mmExcludedList(column, { parentId: 'parent_id' });
```

### Lazy Loading

```typescript
const model = createLazyModel({ db, tableId, tables });

// List with pre-loaded relations
const records = await model.lazy?.listWithRelations({ limit: 10 });

// Read single record with relations
const record = await model.lazy?.readByPkWithRelations('record_id');

// Manually load relations for existing records
const withRelations = await model.lazy?.loadRelations(records);
```

### Copy Operations

```typescript
const model = createCopyModel({ db, tableId, tables });

// Deep copy a single record
const copy = await model.copy?.copyRecordDeep('record_id', {
  copyRelations: true,
  deepCopy: true,
  maxDepth: 3,
  excludeColumns: ['sensitive_field'],
});

// Copy multiple records
const copies = await model.copy?.copyRecordsDeep(['id1', 'id2'], {
  copyRelations: true,
});

// Copy relations between records
await model.copy?.copyRelations('source_id', 'target_id', {
  deepCopy: false,  // Just link, don't duplicate
});
```

### Virtual Column Operations

```typescript
// Virtual columns are automatically included in queries when enabled
const model = createModel({ db, tableId, tables });

// Formula, Rollup, Lookup, and Link count columns
// are computed automatically in list/read operations
const records = await model.list();

// Access virtual column operations directly
const virtualOps = model.virtual;
const virtualColumns = virtualOps?.getVirtualColumns();
```

## Model Options

```typescript
interface ModelOptions {
  virtualColumns?: boolean;   // Formula, Rollup, Lookup support
  linkOperations?: boolean;   // Many-to-many operations
  lazyLoading?: boolean;      // Lazy loading for relations
  copyOperations?: boolean;   // Deep copy functionality
}

// Custom model configuration
import { silentLogger, consoleLogger } from 'jsonb-model';

const model = new Model({
  db,
  tableId: 'users',
  tables,
  config: {
    limitDefault: 25,
    limitMin: 1,
    limitMax: 1000,
    logger: consoleLogger,    // or silentLogger, or custom logger
    queryTimeout: 30000,      // 30 seconds timeout
  },
}, {
  virtualColumns: true,
  linkOperations: true,
  lazyLoading: true,
  copyOperations: true,
});
```

## Custom Logger

You can provide a custom logger implementing the `Logger` interface:

```typescript
import { Logger } from 'jsonb-model';

const customLogger: Logger = {
  debug: (msg, ...args) => myLogger.debug(msg, ...args),
  info: (msg, ...args) => myLogger.info(msg, ...args),
  warn: (msg, ...args) => myLogger.warn(msg, ...args),
  error: (msg, ...args) => myLogger.error(msg, ...args),
};

const model = createModel({
  db,
  tableId: 'users',
  tables,
  config: { logger: customLogger },
});
```

## Database Schema

The library uses two tables:

### `jm_data` - Main data table

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(26) | Primary key (ULID) |
| table_id | VARCHAR(36) | Table identifier for data isolation |
| data | JSONB | User data stored as JSONB |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| created_by | VARCHAR(36) | Creator user ID |
| updated_by | VARCHAR(36) | Last updater user ID |

### `jm_record_links` - Record links table

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(26) | Primary key (ULID) |
| source_record_id | VARCHAR(26) | Source record ID |
| target_record_id | VARCHAR(26) | Target record ID |
| link_field_id | VARCHAR(36) | Link field ID |
| inverse_field_id | VARCHAR(36) | Inverse field ID (bidirectional) |
| created_at | TIMESTAMP | Creation time |

## Supported Column Types

### Regular Columns
- SingleLineText, LongText
- Number, Decimal, Currency, Percent, Rating
- Checkbox
- Date, DateTime, Time, Duration
- Email, PhoneNumber, URL
- SingleSelect, MultiSelect
- Attachment, JSON
- User

### Virtual Columns
- **Formula**: Computed columns with SQL expressions
- **Rollup**: Aggregations across relations
- **Lookup**: Values from related records
- **Links**: Link count

## Error Handling

```typescript
import { ModelError, ErrorCode } from 'jsonb-model';

try {
  await model.readByPk('nonexistent');
} catch (error) {
  if (error instanceof ModelError) {
    console.log(error.code);        // ErrorCode.NOT_FOUND
    console.log(error.statusCode);  // 404
    console.log(error.details);     // { id: 'nonexistent' }
  }
}

// Use static factory methods
ModelError.notFound('Record not found');
ModelError.badRequest('Invalid input');
ModelError.validationError('Field required', { field: 'name' });
```

## License

MIT
