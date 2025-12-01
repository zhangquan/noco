# NocoDB DB Layer

A TypeScript database layer for NocoDB with PostgreSQL JSONB storage.

## Overview

This library implements a unified data access layer using PostgreSQL JSONB storage. All user data is stored in a single JSONB column, while system fields (id, timestamps, etc.) are stored in dedicated columns for optimal indexing and querying.

## Features

- **Unified Storage Model**: All tables stored in `nc_bigtable` and `nc_bigtable_relations`
- **JSONB Storage**: User fields stored in a JSONB column with GIN indexing
- **Full CRUD Operations**: Insert, update, delete, and query operations
- **Many-to-Many Relations**: Full MM relationship support
- **Virtual Columns**: Formula, Rollup, Lookup, and Link columns
- **Flexible Filtering**: Complex filter conditions with AND/OR/NOT logic
- **Sorting**: Multi-column sorting with type casting
- **Pagination**: Configurable limits with sensible defaults
- **Bulk Operations**: Efficient batch insert/update/delete
- **Lazy Loading**: On-demand loading of related data
- **Data Copy**: Copy records and relationships

## Installation

```bash
npm install
```

## Quick Start

```typescript
import knex from 'knex';
import { getBaseModel, createTables, TableType } from './src';

// Create database connection
const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'nocodb',
    user: 'postgres',
    password: 'postgres'
  }
});

// Create tables (run once)
await createTables(db);

// Define your table structure
const usersTable: TableType = {
  id: 'users_table',
  title: 'Users',
  table_name: 'users',
  columns: [
    { id: 'name_col', title: 'Name', column_name: 'name', uidt: 'SingleLineText' },
    { id: 'email_col', title: 'Email', column_name: 'email', uidt: 'Email' },
    { id: 'age_col', title: 'Age', column_name: 'age', uidt: 'Number' }
  ]
};

// Create model instance
const userModel = getBaseModel({
  dbDriver: db,
  modelId: usersTable.id,
  models: [usersTable]
});

// Insert a record
const user = await userModel.insert({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Query records
const users = await userModel.list({
  filterArr: [
    { fk_column_id: 'age_col', comparison_op: 'gte', value: 18 }
  ],
  sortArr: [
    { fk_column_id: 'name_col', direction: 'asc' }
  ],
  limit: 10
});

// Update a record
await userModel.updateByPk(user.id, { age: 31 });

// Delete a record
await userModel.delByPk(user.id);
```

## API Reference

### Factory Functions

#### `getBaseModel(params)`

Creates a base model with full CRUD and link operations.

```typescript
const model = getBaseModel({
  dbDriver: knex,         // Knex instance
  modelId: 'table_id',    // Table ID
  models: tableDefinitions, // All table definitions
  viewId: 'view_id',      // Optional view ID
  type: 'json',           // 'json' | 'link' | 'lazyload' | 'copy'
  config: {               // Optional config
    limitDefault: 25,
    limitMin: 1,
    limitMax: 1000
  }
});
```

#### `getLinkModel(params)`

Creates a model with only link operations (lighter weight).

#### `getLazyloadModel(params)`

Creates a model with lazy loading support for relations.

#### `getCopyModel(params)`

Creates a model with data copy capabilities.

### CRUD Operations

```typescript
// Read by primary key
const record = await model.readByPk(id, fields?);

// Check existence
const exists = await model.exist(id);

// Find one record
const record = await model.findOne({ filterArr, sortArr });

// Insert
const record = await model.insert(data, trx?, cookie?);

// Update
const record = await model.updateByPk(id, data, trx?, cookie?);

// Delete
const count = await model.delByPk(id, trx?, cookie?);
```

### List Operations

```typescript
// List with filtering and sorting
const records = await model.list({
  fields: ['name', 'email'],           // Fields to return
  filterArr: [                          // Filter conditions
    { fk_column_id: 'col_id', comparison_op: 'eq', value: 'test' }
  ],
  sortArr: [                            // Sort configuration
    { fk_column_id: 'col_id', direction: 'asc' }
  ],
  limit: 25,                            // Page size
  offset: 0                             // Page offset
});

// Count records
const count = await model.count({ filterArr });

// Group by
const groups = await model.groupBy({
  column_name: 'status',
  aggregation: 'count'
});
```

### Bulk Operations

```typescript
// Bulk insert (with chunking)
const records = await model.bulkInsert(dataArray, {
  chunkSize: 100,
  cookie: { user: { id: 'user_id' } }
});

// Bulk update
const records = await model.bulkUpdate(dataArrayWithIds);

// Bulk update all matching
const count = await model.bulkUpdateAll(
  { filterArr },
  updateData
);

// Bulk delete
const count = await model.bulkDelete(ids);

// Bulk delete all matching
const count = await model.bulkDeleteAll({ filterArr });
```

### Link Operations (Many-to-Many)

```typescript
// List linked records
const children = await model.mmList({
  colId: 'link_column_id',
  parentRowId: 'parent_id'
}, { limit: 10 });

// Count linked records
const count = await model.mmListCount({
  colId: 'link_column_id',
  parentRowId: 'parent_id'
});

// Get unlinked records
const excluded = await model.getMmChildrenExcludedList({
  colId: 'link_column_id',
  parentRowId: 'parent_id'
});

// Add link
await model.addChild({
  colId: 'link_column_id',
  rowId: 'parent_id',
  childId: 'child_id'
});

// Remove link
await model.removeChild({
  colId: 'link_column_id',
  rowId: 'parent_id',
  childId: 'child_id'
});

// Check if linked
const isLinked = await model.hasChild({
  colId: 'link_column_id',
  parentRowId: 'parent_id',
  childRowId: 'child_id'
});
```

### Filter Operators

| Operator | Description |
|----------|-------------|
| `eq` | Equals |
| `neq` | Not equals |
| `lt` | Less than |
| `lte` | Less than or equals |
| `gt` | Greater than |
| `gte` | Greater than or equals |
| `like` | Contains (case-insensitive) |
| `nlike` | Does not contain |
| `null` | Is null |
| `notnull` | Is not null |
| `empty` | Is empty (null or '') |
| `notempty` | Is not empty |
| `in` | In list |
| `notin` | Not in list |
| `between` | Between two values |
| `allof` | Contains all (MultiSelect) |
| `anyof` | Contains any (MultiSelect) |

### Column Types (UITypes)

- `ID`, `SingleLineText`, `LongText`
- `Number`, `Decimal`, `Currency`, `Percent`, `Rating`
- `Checkbox`
- `Date`, `DateTime`, `Time`, `Duration`
- `Email`, `PhoneNumber`, `URL`
- `SingleSelect`, `MultiSelect`
- `Attachment`, `JSON`
- `Formula`, `Rollup`, `Lookup`
- `LinkToAnotherRecord`, `Links`
- `User`, `CreatedBy`, `LastModifiedBy`
- `CreatedTime`, `LastModifiedTime`
- `AutoNumber`, `Barcode`, `QrCode`
- `GeoData`, `Geometry`

## Database Schema

### nc_bigtable

```sql
CREATE TABLE nc_bigtable (
  id VARCHAR(26) PRIMARY KEY,      -- ULID
  fk_table_id VARCHAR(26) NOT NULL,-- Table identifier
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by VARCHAR(26),
  updated_by VARCHAR(26),
  data JSONB                        -- User data
);
```

### nc_bigtable_relations

```sql
CREATE TABLE nc_bigtable_relations (
  id VARCHAR(26) PRIMARY KEY,
  fk_table_id VARCHAR(26) NOT NULL,-- MM table identifier
  fk_parent_id VARCHAR(26),
  fk_child_id VARCHAR(26),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Performance Tips

1. **GIN Indexes**: Use `@>` operator for JSONB containment queries
2. **Expression Indexes**: Create indexes on frequently queried JSONB fields
3. **Partial Indexes**: Use WHERE clauses for table-specific indexes
4. **Pagination**: Use cursor-based pagination for large datasets
5. **Bulk Operations**: Use `chunkSize` option for large batches

## License

MIT
