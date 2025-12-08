# Types, Models, Cache Architecture Optimization Proposal

## Executive Summary

This document outlines optimization proposals for the `agentdb` and `platform-server` packages, focusing on:
1. Type definitions standardization and simplification
2. Model patterns optimization
3. Cache architecture improvements
4. Overall architecture cleanup

---

## 1. Types Optimization

### 1.1 Current Issues

#### A. Duplicated Filter Types
Filter types are defined in multiple places with slightly different structures:

```typescript
// agentdb/src/types/filter.ts
export interface SimpleFilterCondition {
  eq?: unknown;
  neq?: unknown;
  // ...
}

// agentdb/src/rest-api/types/params.ts  
export type FilterValue = {
  eq?: unknown;
  ne?: unknown;  // Different naming!
  // ...
}
```

**Problem:** `neq` vs `ne`, `notin` vs `notIn` - inconsistent naming.

#### B. Duplicated RequestContext
RequestContext is defined in 3 places:
- `agentdb/src/types/query.ts` - `RequestContext` with `RequestUser`
- `agentdb/src/rest-api/types/request.ts` - `RequestContext` with different structure
- `platform-server/src/types/index.ts` - `RequestContext` with `User` and `trx`

#### C. Legacy Fields in Column Type
The `Column` type has both new and deprecated fields:

```typescript
export interface Column {
  name?: string;           // New
  column_name?: string;    // @deprecated
  required?: boolean;      // New
  rqd?: boolean;           // @deprecated
  defaultValue?: unknown;  // New
  cdf?: string;            // @deprecated
}
```

#### D. Overly Complex Type Unions
`ColumnOption` type is a union that's hard to discriminate:

```typescript
export type ColumnOption =
  | LinkColumnOption
  | FormulaColumnOption
  | RollupColumnOption
  | LookupColumnOption
  | SelectOption[];  // Array type mixed with object types
```

### 1.2 Proposed Optimizations

#### A. Unified Filter Types

```typescript
// agentdb/src/types/filter.ts - OPTIMIZED

/**
 * Standard filter operators (unified naming)
 */
export type FilterOp = 
  | 'eq' | 'ne'        // equals, not equals
  | 'gt' | 'gte'       // greater than, greater than or equal
  | 'lt' | 'lte'       // less than, less than or equal
  | 'like' | 'nlike'   // pattern match
  | 'in' | 'nin'       // in array, not in array
  | 'null' | 'nnull'   // is null, is not null
  | 'empty' | 'nempty' // is empty, is not empty
  | 'contains' | 'ncontains'; // array contains

/**
 * Simplified filter condition with consistent naming
 */
export interface FilterCondition {
  eq?: unknown;
  ne?: unknown;       // Standardized from neq/ne
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  like?: string;
  nlike?: string;
  in?: unknown[];
  nin?: unknown[];    // Standardized from notin/notIn
  null?: boolean;
  nnull?: boolean;    // Standardized from notnull
  empty?: boolean;
  nempty?: boolean;   // Standardized from notempty
  contains?: unknown;
  ncontains?: unknown;
}

/**
 * Simple filter map (column -> condition)
 */
export type SimpleFilter = Record<string, unknown | FilterCondition>;

/**
 * Simple sort map (column -> direction)
 */
export type SimpleSort = Record<string, 'asc' | 'desc'>;
```

#### B. Unified RequestContext

```typescript
// agentdb/src/types/context.ts - NEW FILE

/**
 * Authenticated user info (minimal, serializable)
 */
export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  roles?: string[];
}

/**
 * Audit/tracking context
 */
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  ip?: string;
  userAgent?: string;
  locale?: string;
}

/**
 * Base request context (no DB dependencies)
 */
export interface BaseRequestContext {
  user?: AuthUser;
  audit?: AuditContext;
}

// For DB layer (with transaction support)
export interface DbRequestContext extends BaseRequestContext {
  trx?: Knex.Transaction;
}

// For REST API layer (with full request info)
export interface ApiRequestContext extends BaseRequestContext {
  db: Knex;
  tables: Table[];
  table?: Table;
  tableId?: string;
}
```

#### C. Clean Column Type (Remove Deprecated Fields)

```typescript
// agentdb/src/types/column.ts - OPTIMIZED

/**
 * Column constraints
 */
export interface ColumnConstraints {
  required?: boolean;
  unique?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enumValues?: string[];
}

/**
 * Base column definition (common fields)
 */
export interface BaseColumn {
  id: string;
  title: string;
  name: string;  // Required, no longer optional
  uidt: UITypes;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  system?: boolean;
  order?: number;
  constraints?: ColumnConstraints;
  examples?: unknown[];
  meta?: Record<string, unknown>;
}

/**
 * Link column with typed options
 */
export interface LinkColumn extends BaseColumn {
  uidt: UITypes.Links | UITypes.LinkToAnotherRecord;
  options: LinkColumnOptions;
}

/**
 * Formula column with typed options
 */
export interface FormulaColumn extends BaseColumn {
  uidt: UITypes.Formula;
  options: FormulaColumnOptions;
}

/**
 * Select column with typed options
 */
export interface SelectColumn extends BaseColumn {
  uidt: UITypes.SingleSelect | UITypes.MultiSelect;
  options: SelectColumnOptions;
}

/**
 * Regular column (no special options)
 */
export interface DataColumn extends BaseColumn {
  options?: never;
}

/**
 * Discriminated union for all column types
 */
export type Column = LinkColumn | FormulaColumn | SelectColumn | DataColumn;

/**
 * Type guard for link columns
 */
export function isLinkColumn(col: Column): col is LinkColumn {
  return col.uidt === UITypes.Links || col.uidt === UITypes.LinkToAnotherRecord;
}
```

#### D. Separate Column Option Types

```typescript
// agentdb/src/types/column-options.ts - NEW FILE

export interface LinkColumnOptions {
  type: RelationTypes;
  fk_related_model_id: string;
  fk_child_column_id?: string;
  fk_parent_column_id?: string;
  fk_mm_model_id?: string;
  fk_symmetric_column_id?: string;
  virtual?: boolean;
}

export interface FormulaColumnOptions {
  formula: string;
  formulaRaw?: string;
  parsedTree?: unknown;
}

export interface RollupColumnOptions {
  fk_relation_column_id: string;
  fk_rollup_column_id: string;
  rollup_function: RollupFunction;
}

export interface LookupColumnOptions {
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
}

export interface SelectOption {
  id: string;
  title: string;
  color?: string;
  order?: number;
}

export interface SelectColumnOptions {
  options: SelectOption[];
}
```

### 1.3 Types Index File Optimization

```typescript
// agentdb/src/types/index.ts - OPTIMIZED

/**
 * Type definitions barrel export
 * Organized by domain for clarity
 */

// ============================================================================
// Core Types
// ============================================================================
export { UITypes, RelationTypes } from './column';
export type { Column, BaseColumn, LinkColumn, FormulaColumn, SelectColumn } from './column';
export { isLinkColumn, isFormulaColumn, isSelectColumn } from './column';

export type { Table, View, ViewTypes } from './table';

// ============================================================================
// Column Options
// ============================================================================
export type {
  LinkColumnOptions,
  FormulaColumnOptions,
  RollupColumnOptions,
  LookupColumnOptions,
  SelectColumnOptions,
  SelectOption,
  ColumnConstraints,
} from './column-options';

// ============================================================================
// Filter & Sort
// ============================================================================
export type {
  FilterCondition,
  SimpleFilter,
  SimpleSort,
  Filter,
  Sort,
  FilterOp,
  SortDirection,
} from './filter';

// ============================================================================
// Query
// ============================================================================
export type {
  ListArgs,
  GroupByArgs,
  BulkOptions,
  DataRecord,
  BulkWriteOperation,
  BulkWriteResult,
} from './query';

// ============================================================================
// Context
// ============================================================================
export type {
  AuthUser,
  AuditContext,
  BaseRequestContext,
  DbRequestContext,
  ApiRequestContext,
} from './context';

// ============================================================================
// Schema
// ============================================================================
export type {
  SchemaDescription,
  TableOverview,
  RelationshipInfo,
} from './schema';

// ============================================================================
// Constants
// ============================================================================
export {
  SYSTEM_COLUMN_TYPES,
  VIRTUAL_COLUMN_TYPES,
  SYSTEM_COLUMN_NAMES,
  DEFAULT_ID_COLUMN,
} from './constants';
```

---

## 2. Models Optimization

### 2.1 Current Issues

#### A. Repetitive Cache Logic in Platform-Server Models

```typescript
// Current: Every model repeats this pattern
static async get(id: string, options?: TableOptions): Promise<User | null> {
  const data = await getById<UserType>(CACHE_SCOPE, META_TABLE, id, options);
  return data ? new User(data) : null;
}

static async update(id: string, data: Partial<...>, options?: TableOptions): Promise<void> {
  await updateRecord<UserType>(CACHE_SCOPE, META_TABLE, id, data, options);
}
```

#### B. Active Record vs Repository Pattern Mixing
Models have both instance methods and static methods, leading to confusion.

### 2.2 Proposed Optimizations

#### A. Generic Base Model Class

```typescript
// platform-server/src/models/BaseModel.ts - NEW FILE

import type { Knex } from 'knex';
import { CacheScope, MetaTable } from '../types/index.js';
import { NocoCache } from '../cache/index.js';
import { getDb, generateId } from '../db/index.js';

export interface ModelOptions {
  knex?: Knex;
  skipCache?: boolean;
}

export interface QueryOptions {
  condition?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
}

/**
 * Generic base model with common CRUD operations
 * Reduces boilerplate in entity models
 */
export abstract class BaseModel<T extends { id: string }> {
  protected data: T;
  
  protected abstract get cacheScope(): CacheScope;
  protected abstract get tableName(): MetaTable;
  
  constructor(data: T) {
    this.data = data;
  }

  get id(): string { return this.data.id; }
  getData(): T { return this.data; }
  toJSON(): T { return { ...this.data }; }

  // ========== Protected Static Helpers ==========
  
  protected static getDb(options?: ModelOptions): Knex {
    return options?.knex || getDb();
  }

  protected static getCache(): NocoCache {
    return NocoCache.getInstance();
  }

  protected static buildCacheKey(scope: CacheScope, id: string): string {
    return `${scope}:${id}`;
  }

  // ========== Generic CRUD Operations ==========

  protected static async getById<T extends { id: string }>(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    options?: ModelOptions
  ): Promise<T | null> {
    const cache = this.getCache();
    const cacheKey = this.buildCacheKey(scope, id);

    if (!options?.skipCache) {
      const cached = await cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    const db = this.getDb(options);
    const data = await db(table).where('id', id).first();
    if (!data) return null;

    if (!options?.skipCache) {
      await cache.set(cacheKey, data);
    }

    return data as T;
  }

  protected static async insertRecord<T extends { id?: string }>(
    scope: CacheScope,
    table: MetaTable,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>,
    options?: ModelOptions
  ): Promise<string> {
    const db = this.getDb(options);
    const cache = this.getCache();
    const now = new Date();

    const record = {
      id: generateId(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    await db(table).insert(record);

    if (!options?.skipCache) {
      await cache.set(this.buildCacheKey(scope, record.id), record);
    }

    return record.id;
  }

  protected static async updateRecord<T>(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    data: Partial<T>,
    options?: ModelOptions
  ): Promise<void> {
    const db = this.getDb(options);
    const cache = this.getCache();
    const cacheKey = this.buildCacheKey(scope, id);

    const updateData = {
      ...data,
      updated_at: new Date(),
    };

    await db(table).where('id', id).update(updateData);

    if (!options?.skipCache) {
      // Invalidate cache - next read will refresh
      await cache.del(cacheKey);
    }
  }

  protected static async deleteRecord(
    scope: CacheScope,
    table: MetaTable,
    id: string,
    options?: ModelOptions
  ): Promise<number> {
    const db = this.getDb(options);
    const cache = this.getCache();

    const result = await db(table).where('id', id).delete();

    if (!options?.skipCache) {
      await cache.del(this.buildCacheKey(scope, id));
    }

    return result;
  }

  protected static async listRecords<T>(
    scope: CacheScope,
    table: MetaTable,
    listKey: string,
    queryOptions?: QueryOptions,
    options?: ModelOptions
  ): Promise<T[]> {
    const cache = this.getCache();
    const cacheKey = `${scope}:list:${listKey}`;

    if (!options?.skipCache) {
      const cached = await cache.get<T[]>(cacheKey);
      if (cached) return cached;
    }

    const db = this.getDb(options);
    let query = db(table);

    if (queryOptions?.condition) {
      query = query.where(queryOptions.condition);
    }

    if (queryOptions?.orderBy) {
      for (const [col, dir] of Object.entries(queryOptions.orderBy)) {
        query = query.orderBy(col, dir);
      }
    }

    if (queryOptions?.limit) query = query.limit(queryOptions.limit);
    if (queryOptions?.offset) query = query.offset(queryOptions.offset);

    const results = await query;

    if (!options?.skipCache) {
      await cache.set(cacheKey, results, 300);
    }

    return results as T[];
  }
}
```

#### B. Simplified User Model

```typescript
// platform-server/src/models/User.ts - OPTIMIZED

import bcrypt from 'bcryptjs';
import { CacheScope, MetaTable } from '../types/index.js';
import type { User as UserType, UserRole } from '../types/index.js';
import { BaseModel, type ModelOptions } from './BaseModel.js';

export class User extends BaseModel<UserType> {
  protected get cacheScope() { return CacheScope.USER; }
  protected get tableName() { return MetaTable.USERS; }

  // Getters (simple, computed from data)
  get email(): string { return this.data.email; }
  get firstname(): string | undefined { return this.data.firstname; }
  get lastname(): string | undefined { return this.data.lastname; }
  get roles(): UserRole { return this.data.roles; }
  get emailVerified(): boolean { return this.data.email_verified ?? false; }

  get displayName(): string {
    if (this.firstname || this.lastname) {
      return `${this.firstname || ''} ${this.lastname || ''}`.trim();
    }
    return this.email.split('@')[0];
  }

  // Safe serialization (omit sensitive fields)
  toSafeJSON(): Omit<UserType, 'password' | 'salt'> {
    const { password, salt, ...safe } = this.data;
    return safe;
  }

  // Instance methods
  async verifyPassword(password: string): Promise<boolean> {
    if (!this.data.password) return false;
    return bcrypt.compare(password, this.data.password);
  }

  // ========== Static Methods ==========

  static async get(id: string, options?: ModelOptions): Promise<User | null> {
    const data = await this.getById<UserType>(
      CacheScope.USER,
      MetaTable.USERS,
      id,
      options
    );
    return data ? new User(data) : null;
  }

  static async getByEmail(email: string, options?: ModelOptions): Promise<User | null> {
    const cache = this.getCache();
    const emailKey = `${CacheScope.USER}:email:${email.toLowerCase()}`;

    if (!options?.skipCache) {
      const cachedId = await cache.get<string>(emailKey);
      if (cachedId) return this.get(cachedId, options);
    }

    const db = this.getDb(options);
    const data = await db(MetaTable.USERS)
      .where('email', email.toLowerCase())
      .first();

    if (!data) return null;

    if (!options?.skipCache) {
      await cache.set(emailKey, data.id);
      await cache.set(`${CacheScope.USER}:${data.id}`, data);
    }

    return new User(data);
  }

  static async create(data: {
    email: string;
    password?: string;
    firstname?: string;
    lastname?: string;
    roles?: UserRole;
  }, options?: ModelOptions): Promise<User> {
    let hashedPassword: string | undefined;
    let salt: string | undefined;

    if (data.password) {
      salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(data.password, salt);
    }

    const id = await this.insertRecord<UserType>(
      CacheScope.USER,
      MetaTable.USERS,
      {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        salt,
        firstname: data.firstname,
        lastname: data.lastname,
        roles: data.roles || 'user',
        email_verified: false,
      },
      options
    );

    return (await this.get(id, { ...options, skipCache: true }))!;
  }

  static async update(id: string, data: Partial<UserType>, options?: ModelOptions): Promise<void> {
    const updateData = { ...data };

    // Hash password if provided
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
      updateData.salt = salt;
    }

    // Normalize email
    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }

    await this.updateRecord<UserType>(
      CacheScope.USER,
      MetaTable.USERS,
      id,
      updateData,
      options
    );

    // Invalidate email cache if email changed
    if (data.email) {
      const cache = this.getCache();
      await cache.del(`${CacheScope.USER}:email:${data.email.toLowerCase()}`);
    }
  }

  static async delete(id: string, options?: ModelOptions): Promise<number> {
    const user = await this.get(id, options);
    if (user) {
      const cache = this.getCache();
      await cache.del(`${CacheScope.USER}:email:${user.email}`);
    }
    return this.deleteRecord(CacheScope.USER, MetaTable.USERS, id, options);
  }

  static async list(options?: ModelOptions): Promise<User[]> {
    const data = await this.listRecords<UserType>(
      CacheScope.USER,
      MetaTable.USERS,
      'all',
      { orderBy: { created_at: 'desc' } },
      options
    );
    return data.map(d => new User(d));
  }
}
```

---

## 3. Cache Optimization

### 3.1 Current Issues

#### A. Inconsistent Cache Key Patterns
```typescript
// Sometimes uses buildCacheKey
const key = buildCacheKey({ scope, id });

// Sometimes manual string interpolation
const cacheKey = `${CACHE_SCOPE}:${id}`;
const emailKey = `${CACHE_SCOPE}:email:${email}`;
```

#### B. Memory Leak in WriteBehindCache
The `pending` Map can grow unbounded if `flush()` repeatedly fails.

#### C. No Cache Metrics by Default
Statistics are only collected when using `cacheAsideWithStats`.

### 3.2 Proposed Optimizations

#### A. Standardized Cache Keys

```typescript
// platform-server/src/cache/keys.ts - NEW FILE

import { CacheScope } from '../types/index.js';

export const CacheKeys = {
  // Entity by ID
  entity: (scope: CacheScope, id: string) => `${scope}:${id}`,
  
  // Entity list
  list: (scope: CacheScope, key: string) => `${scope}:list:${key}`,
  
  // Secondary index (e.g., user by email)
  index: (scope: CacheScope, field: string, value: string) => 
    `${scope}:${field}:${value}`,
  
  // User-specific list
  userList: (scope: CacheScope, userId: string) => 
    `${scope}:user:${userId}`,
  
  // Pattern for invalidation
  scopePattern: (scope: CacheScope) => `${scope}:*`,
} as const;

// Type-safe cache key builder
export function cacheKey<S extends CacheScope>(
  scope: S,
  ...parts: string[]
): string {
  return [scope, ...parts].join(':');
}
```

#### B. Enhanced WriteBehindCache with Max Pending

```typescript
// platform-server/src/cache/write-behind.ts - OPTIMIZED

export interface WriteBehindOptions<T> {
  writeFn: (items: Array<{ key: string; data: T }>) => Promise<void>;
  flushIntervalMs?: number;
  ttl?: number;
  maxPending?: number;  // NEW: Limit pending items
  onFlushError?: (error: Error, items: Array<{ key: string; data: T }>) => void;
}

export class WriteBehindCache<T> {
  private pending = new Map<string, { data: T; timestamp: number }>();
  private flushInterval: NodeJS.Timeout;
  private ttl: number;
  private maxPending: number;
  private writeFn: WriteBehindOptions<T>['writeFn'];
  private onFlushError?: WriteBehindOptions<T>['onFlushError'];
  private flushing = false;

  constructor(options: WriteBehindOptions<T>) {
    this.writeFn = options.writeFn;
    this.ttl = options.ttl ?? 3600;
    this.maxPending = options.maxPending ?? 1000;
    this.onFlushError = options.onFlushError;
    
    this.flushInterval = setInterval(
      () => this.flush(),
      options.flushIntervalMs ?? 5000
    );
  }

  async set(key: string, data: T): Promise<void> {
    const cache = NocoCache.getInstance();
    await cache.set(key, data, this.ttl);
    
    this.pending.set(key, { data, timestamp: Date.now() });
    
    // Force flush if too many pending items
    if (this.pending.size >= this.maxPending) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.pending.size === 0) return;
    
    this.flushing = true;
    const items = Array.from(this.pending.entries()).map(([key, { data }]) => ({
      key,
      data,
    }));
    this.pending.clear();

    try {
      await this.writeFn(items);
    } catch (error) {
      // Don't re-add all items - could cause infinite growth
      // Instead, notify via callback
      this.onFlushError?.(error as Error, items);
    } finally {
      this.flushing = false;
    }
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  destroy(): void {
    clearInterval(this.flushInterval);
  }
}
```

#### C. Integrated Cache Metrics

```typescript
// platform-server/src/cache/metrics.ts - NEW FILE

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  avgLatencyMs: number;
}

class CacheMetricsCollector {
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private totalLatencyMs = 0;
  private operationCount = 0;

  recordHit(latencyMs: number = 0): void {
    this.hits++;
    this.recordLatency(latencyMs);
  }

  recordMiss(latencyMs: number = 0): void {
    this.misses++;
    this.recordLatency(latencyMs);
  }

  recordSet(): void {
    this.sets++;
  }

  recordDelete(): void {
    this.deletes++;
  }

  private recordLatency(ms: number): void {
    this.totalLatencyMs += ms;
    this.operationCount++;
  }

  getMetrics(): CacheMetrics {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      hitRate: total > 0 ? this.hits / total : 0,
      avgLatencyMs: this.operationCount > 0 
        ? this.totalLatencyMs / this.operationCount 
        : 0,
    };
  }

  reset(): void {
    this.hits = this.misses = this.sets = this.deletes = 0;
    this.totalLatencyMs = this.operationCount = 0;
  }
}

export const cacheMetrics = new CacheMetricsCollector();

// Wrap cache operations with metrics
export function withMetrics<T>(
  operation: () => Promise<T>,
  type: 'get' | 'set' | 'delete'
): Promise<T> {
  const start = Date.now();
  return operation().then(result => {
    const latency = Date.now() - start;
    if (type === 'get') {
      if (result !== null && result !== undefined) {
        cacheMetrics.recordHit(latency);
      } else {
        cacheMetrics.recordMiss(latency);
      }
    } else if (type === 'set') {
      cacheMetrics.recordSet();
    } else {
      cacheMetrics.recordDelete();
    }
    return result;
  });
}
```

---

## 4. Architecture Optimization

### 4.1 Proposed File Structure

```
packages/
├── agentdb/
│   └── src/
│       ├── types/
│       │   ├── index.ts           # Barrel export
│       │   ├── column.ts          # Column types + type guards
│       │   ├── column-options.ts  # Column option types (separate)
│       │   ├── table.ts           # Table types
│       │   ├── filter.ts          # Filter/Sort types (unified)
│       │   ├── query.ts           # Query args
│       │   ├── context.ts         # Request context types (unified)
│       │   ├── schema.ts          # Schema description types
│       │   └── constants.ts       # System constants
│       ├── models/
│       │   ├── index.ts
│       │   └── Model.ts
│       └── ...
│
└── platform-server/
    └── src/
        ├── types/
        │   ├── index.ts           # Barrel export
        │   ├── entities.ts        # User, Project, etc.
        │   ├── enums.ts           # CacheScope, MetaTable, etc.
        │   ├── acl.ts             # Permissions & ACL
        │   └── request.ts         # API request types
        ├── models/
        │   ├── index.ts
        │   ├── BaseModel.ts       # Generic base class
        │   ├── User.ts
        │   ├── Project.ts
        │   └── ...
        ├── cache/
        │   ├── index.ts           # Main exports
        │   ├── NocoCache.ts       # Cache implementation
        │   ├── keys.ts            # Cache key builders
        │   ├── metrics.ts         # Cache metrics
        │   ├── patterns.ts        # Cache-aside, write-through, etc.
        │   └── write-behind.ts    # Write-behind implementation
        └── ...
```

### 4.2 Naming Convention Standardization

| Old (Inconsistent) | New (Standardized) |
|--------------------|--------------------|
| `neq` / `ne` | `ne` |
| `notin` / `notIn` | `nin` |
| `notnull` | `nnull` |
| `notempty` | `nempty` |
| `column_name` | `name` |
| `created_at` | `createdAt` (in TS) |
| `user_id` | `userId` (in TS) |

**Note:** Keep `snake_case` for database columns, use `camelCase` in TypeScript interfaces.

### 4.3 Import Organization

```typescript
// Standard import order in all files:

// 1. Node.js built-ins
import { EventEmitter } from 'events';

// 2. External packages
import type { Knex } from 'knex';
import { ulid } from 'ulid';

// 3. Internal types (always use `type` imports for types)
import type { Column, Table, ListArgs } from '../types';
import { UITypes, RelationTypes } from '../types';

// 4. Internal modules
import { NocoCache } from '../cache';
import { buildQuery } from '../query';
```

---

## 5. Implementation Priority

### Phase 1: Quick Wins (Low Risk)
1. ✅ Create `constants.ts` file for system constants
2. ✅ Create `column-options.ts` for separated option types
3. ✅ Add type guards for column types
4. ✅ Standardize cache key builders

### Phase 2: Type Cleanup (Medium Risk)
1. Unify filter/sort types with consistent naming
2. Create unified `context.ts` with request context types
3. Remove deprecated fields from Column type
4. Split platform-server types into separate files

### Phase 3: Model Refactoring (Higher Risk)
1. Create `BaseModel` class for platform-server
2. Migrate existing models to use BaseModel
3. Add cache metrics collection

### Phase 4: Cache Improvements
1. Fix WriteBehindCache memory leak
2. Integrate metrics into main cache operations
3. Standardize all cache key usage

---

## 6. Migration Strategy

### For Type Changes:
```typescript
// 1. Add new types alongside old ones
export interface FilterCondition { /* new */ }
/** @deprecated Use FilterCondition */
export interface SimpleFilterCondition { /* old */ }

// 2. Create migration period with both exports
export { FilterCondition, SimpleFilterCondition };

// 3. Update internal usage to new types

// 4. After all internal code migrated, remove deprecated
```

### For Model Changes:
```typescript
// 1. Create BaseModel without changing existing models

// 2. Create new model (e.g., UserV2) using BaseModel

// 3. Test thoroughly

// 4. Migrate one model at a time

// 5. Remove old Table.ts helpers once all models migrated
```

---

## 7. Testing Checklist

- [ ] All existing tests pass after type changes
- [ ] Filter parsing works with new unified types
- [ ] Cache operations maintain same behavior
- [ ] Model CRUD operations work correctly
- [ ] No runtime type errors in production

---

## Appendix: Code Examples

### Example: Using Optimized Types

```typescript
import type { SimpleFilter, SimpleSort, Column } from '@agentdb/types';
import { isLinkColumn } from '@agentdb/types';

// Type-safe filter
const filter: SimpleFilter = {
  status: 'active',
  age: { gte: 18, lt: 65 },
  email: { like: '%@example.com' },
};

// Type-safe sort
const sort: SimpleSort = {
  created_at: 'desc',
  name: 'asc',
};

// Type-safe column handling
function processColumn(col: Column) {
  if (isLinkColumn(col)) {
    // TypeScript knows col.options is LinkColumnOptions
    console.log(col.options.fk_related_model_id);
  }
}
```

### Example: Using Optimized Cache

```typescript
import { cacheKey, CacheKeys } from '../cache/keys';
import { cacheAside } from '../cache/patterns';
import { CacheScope } from '../types';

// Type-safe cache keys
const userKey = CacheKeys.entity(CacheScope.USER, userId);
const emailKey = CacheKeys.index(CacheScope.USER, 'email', email);
const listKey = CacheKeys.list(CacheScope.PROJECT, 'all');

// Cache-aside pattern
const user = await cacheAside(
  userKey,
  () => db('users').where('id', userId).first(),
  { ttl: 3600 }
);
```

---

*Document Version: 1.0*
*Created: December 2024*
