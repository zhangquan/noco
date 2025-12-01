# NocoDB Database Layer

A clean, extensible database abstraction layer for PostgreSQL with JSONB storage.

## Features

- 🚀 **High Performance**: Optimized for PostgreSQL with JSONB storage and GIN indexes
- 📦 **Clean Architecture**: Well-organized modular structure with clear separation of concerns
- 🔗 **Relationship Support**: Full many-to-many relationship operations
- 🧮 **Virtual Columns**: Support for Formula, Rollup, Lookup, and Links columns
- 📋 **Bulk Operations**: Efficient batch insert, update, and delete
- 🔄 **Lazy Loading**: Optional lazy loading for related records
- 📝 **Copy Operations**: Deep copy records with relationships

## Installation

```bash
npm install nocodb-db-layer
```

## Quick Start

```typescript
import { createModel, createTables } from 'nocodb-db-layer';
import knex from 'knex';

// Setup database connection
const db = knex({
  client: 'pg',
  connection: 'postgresql://localhost/mydb',
});

// Create required tables
await createTables(db);

// Define your table schema
const tables = [
  {
    id: 'users',
    title: 'Users',
    table_name: 'users',
    columns: [
      { id: 'name', title: 'Name', column_name: 'name', uidt: 'SingleLineText' },
      { id: 'email', title: 'Email', column_name: 'email', uidt: 'Email' },
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
│   ├── interfaces.ts  # IBaseModel, ILinkModel, IModel
│   ├── NcError.ts     # Error handling
│   ├── BaseModel.ts   # Base CRUD implementation
│   ├── LinkModel.ts   # Many-to-many operations
│   └── index.ts
├── models/          # Model implementations
│   ├── Model.ts       # Full model with virtual columns
│   ├── LazyModel.ts   # Lazy loading support
│   ├── CopyModel.ts   # Copy/duplicate operations
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

Create a model instance with the specified configuration.

```typescript
const model = createModel({
  db: knex,
  tableId: 'users',
  tables: allTables,
  type: 'default', // 'default' | 'lazy' | 'copy'
});
```

#### `createLazyModel(params)`

Create a model with lazy loading support for relations.

#### `createCopyModel(params)`

Create a model with copy/duplicate functionality.

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
// List linked records
const linked = await model.mmList({
  colId: 'link_column_id',
  parentRowId: 'parent_id',
});

// Count linked records
const count = await model.mmListCount({
  colId: 'link_column_id',
  parentRowId: 'parent_id',
});

// Add link
await model.addLink({
  colId: 'link_column_id',
  rowId: 'parent_id',
  childId: 'child_id',
});

// Remove link
await model.removeLink({
  colId: 'link_column_id',
  rowId: 'parent_id',
  childId: 'child_id',
});
```

### Lazy Loading

```typescript
const lazyModel = createLazyModel({ db, tableId, tables });

// Load relations lazily
const relations = await lazyModel.loadRelated(record, 'link_col_id');

// Batch load for multiple records
const { records, relations } = await lazyModel.listWithRelations({
  limit: 10,
  preloadRelations: ['link_col_1', 'link_col_2'],
});
```

### Copy Operations

```typescript
const copyModel = createCopyModel({ db, tableId, tables });

// Copy a single record
const result = await copyModel.copyRecord('record_id', {
  copyRelations: true,
  excludeFields: ['sensitive_field'],
});

// Deep copy with all linked records
const { root, all } = await copyModel.deepCopy('record_id', {
  maxDepth: 3,
});
```

## Database Schema

The library uses two tables:

### `nc_bigtable` - Main data table

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR | Primary key (ULID) |
| fk_table_id | VARCHAR | Table identifier |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |
| created_by | VARCHAR | Creator user ID |
| updated_by | VARCHAR | Last updater user ID |
| data | JSONB | Row data |

### `nc_bigtable_relations` - Relations table

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR | Primary key (ULID) |
| fk_table_id | VARCHAR | Junction table ID |
| fk_parent_id | VARCHAR | Parent record ID |
| fk_child_id | VARCHAR | Child record ID |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

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

## Configuration

```typescript
import { DEFAULT_MODEL_CONFIG } from 'nocodb-db-layer';

const model = createModel({
  db,
  tableId: 'users',
  tables,
  config: {
    limitDefault: 25,  // Default page size
    limitMin: 1,       // Minimum page size
    limitMax: 1000,    // Maximum page size
  },
});
```

## Error Handling

```typescript
import { NcError } from 'nocodb-db-layer';

try {
  await model.readByPk('nonexistent');
} catch (error) {
  if (error instanceof NcError) {
    console.log(error.code);        // 'NOT_FOUND'
    console.log(error.statusCode);  // 404
    console.log(error.details);     // { id: 'nonexistent' }
  }
}
```

## License

MIT
