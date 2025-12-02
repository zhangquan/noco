# AgentDB

AI Agent-friendly PostgreSQL database layer with JSONB storage.

## Features

- 🤖 **AI-Friendly**: Schema descriptions, semantic metadata, and simplified query syntax
- 🚀 **High Performance**: Optimized for PostgreSQL with JSONB storage and GIN indexes
- 📦 **Composition Pattern**: Modular operations that can be combined flexibly
- 🔗 **Relationship Support**: Full many-to-many relationship operations
- 🧮 **Virtual Columns**: Support for Formula, Rollup, Lookup, and Links columns
- 📋 **Bulk Operations**: Efficient batch insert, update, and delete
- 🔄 **Atomic Transactions**: Simple `atomic()` wrapper for complex operations

## Installation

```bash
npm install agentdb
```

## Quick Start

```typescript
import { createModel, initDatabase } from 'agentdb';
import knex from 'knex';

// Setup database connection
const db = knex({
  client: 'pg',
  connection: 'postgresql://localhost/mydb',
});

// Initialize database schema
await initDatabase(db);

// Define your table schema with AI-friendly metadata
const tables = [
  {
    id: 'users',
    title: 'Users',
    description: 'User accounts for the application',
    hints: ['Email must be unique', 'Name is required'],
    columns: [
      { 
        id: 'name', 
        title: 'Name', 
        uidt: 'SingleLineText',
        description: 'User display name',
        examples: ['John Doe', 'Jane Smith'],
        constraints: { required: true, maxLength: 100 }
      },
      { 
        id: 'email', 
        title: 'Email', 
        uidt: 'Email',
        description: 'User email address for login',
        examples: ['john@example.com'],
        constraints: { required: true, unique: true }
      },
      {
        id: 'age',
        title: 'Age',
        uidt: 'Number',
        description: 'User age in years',
        constraints: { min: 0, max: 150 }
      },
    ],
  },
];

// Create a model instance
const model = createModel({ db, tableId: 'users', tables });

// AI can understand the schema
const schema = model.describeSchema();
console.log(schema);
// {
//   table: { id: 'users', title: 'Users', description: '...' },
//   columns: [{ id: 'name', type: 'SingleLineText', required: true, ... }],
//   relationships: []
// }

// CRUD operations with simplified syntax
const user = await model.insert({ name: 'John', email: 'john@example.com' });

// Simplified filter syntax
const users = await model.list({
  filter: { 
    age: { gte: 18, lt: 65 },
    email: { like: '%@company.com' }
  },
  sortBy: { created_at: 'desc' },
  limit: 10
});

await model.updateByPk(user.id, { name: 'Jane' });
await model.deleteByPk(user.id);
```

## AI-Friendly Schema

### Column Metadata

```typescript
interface Column {
  id: string;
  title: string;
  uidt: UITypes;
  
  // AI-friendly fields
  description?: string;           // Human-readable description
  examples?: unknown[];           // Example values
  constraints?: {
    required?: boolean;
    unique?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;             // Regex pattern
    enumValues?: string[];        // Valid values for select types
  };
}
```

### Table Metadata

```typescript
interface Table {
  id: string;
  title: string;
  columns?: Column[];
  
  // AI-friendly fields
  description?: string;           // What this table stores
  hints?: string[];               // Business rules for AI to follow
}
```

### Schema Discovery

```typescript
// Get current table schema
const schema = model.describeSchema();

// Get overview of all tables
const tables = model.describeAllTables();
// [
//   { id: 'users', title: 'Users', description: '...', columnCount: 5, relationCount: 2 },
//   { id: 'orders', title: 'Orders', description: '...', columnCount: 8, relationCount: 3 }
// ]
```

## Simplified Query Syntax

### Filter

```typescript
// Simplified (AI-friendly)
await model.list({
  filter: {
    status: 'active',                    // equals
    age: { gte: 18, lt: 65 },            // range
    name: { like: '%john%' },            // contains
    tags: { contains: 'vip' },           // array contains
    email: { notnull: true }             // not null
  }
});

// Original (still supported)
await model.list({
  filterArr: [
    { fk_column_id: 'status', comparison_op: 'eq', value: 'active' }
  ]
});
```

### Sort

```typescript
// Simplified (AI-friendly)
await model.list({
  sortBy: { created_at: 'desc', name: 'asc' }
});

// Original (still supported)
await model.list({
  sort: '-created_at,name'
});
```

## Atomic Transactions

```typescript
// Execute multiple operations atomically
const result = await model.atomic(async (m) => {
  const user = await m.insert({ name: 'John', email: 'john@example.com' });
  const order = await orderModel.insert({ userId: user.id, total: 100 });
  await m.links?.mmLink(orderColumn, [order.id], user.id);
  return { user, order };
});
// Automatically commits on success, rolls back on failure
```

## Mixed Bulk Operations

```typescript
// Execute multiple different operations in one transaction
const result = await model.bulkWrite([
  { op: 'insert', data: { name: 'User A' } },
  { op: 'insert', data: { name: 'User B' } },
  { op: 'update', id: 'existing_id', data: { status: 'active' } },
  { op: 'delete', id: 'old_id' },
  { op: 'link', columnId: 'orders', parentId: 'user_id', childIds: ['order1', 'order2'] }
]);

console.log(result);
// {
//   success: true,
//   insertedIds: ['id1', 'id2'],
//   updatedCount: 1,
//   deletedCount: 1,
//   linkedCount: 2,
//   unlinkedCount: 0
// }
```

## Model Factory Functions

```typescript
// Default model (virtual columns + links)
const model = createModel({ db, tableId, tables });

// With lazy loading
const lazyModel = createLazyModel({ db, tableId, tables });

// With copy operations
const copyModel = createCopyModel({ db, tableId, tables });

// All features enabled
const fullModel = createFullModel({ db, tableId, tables });

// Minimal (CRUD only, best performance)
const minimalModel = createMinimalModel({ db, tableId, tables });
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
import { ModelError, ErrorCode } from 'agentdb';

try {
  await model.readByPk('nonexistent');
} catch (error) {
  if (error instanceof ModelError) {
    console.log(error.code);        // ErrorCode.NOT_FOUND
    console.log(error.statusCode);  // 404
    console.log(error.details);     // { id: 'nonexistent' }
  }
}
```

## License

MIT
