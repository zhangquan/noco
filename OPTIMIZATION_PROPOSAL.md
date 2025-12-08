# Platform-Server Types, Models, Cache Optimization Proposal

## Executive Summary

This document outlines optimization proposals for the `platform-server` package, focusing on:
1. Type definitions standardization and organization
2. Model patterns optimization with BaseModel
3. Cache architecture improvements

---

## 1. Types Optimization

### 1.1 Issues Identified

#### A. Monolithic Type File
All types were in a single 312-line file (`types/index.ts`), mixing:
- Entity types (User, Project, Page, Flow)
- Enums (CacheScope, MetaTable)
- ACL definitions
- Request context types

#### B. Missing Input Types
No dedicated types for create/update operations, leading to inconsistent parameter types.

### 1.2 Implemented Optimizations

#### A. Split Types into Domain Files

```
types/
├── index.ts      # Barrel export (clean re-exports)
├── enums.ts      # CacheScope, MetaTable, role types
├── entities.ts   # User, Project, Page, Flow, etc.
├── acl.ts        # Permissions and ACL helpers
└── request.ts    # API request/response types
```

#### B. New Type Exports

```typescript
// types/enums.ts
export enum CacheScope { USER, PROJECT, PAGE, FLOW, ... }
export enum MetaTable { USERS, PROJECTS, PAGES, FLOWS, ... }
export type UserRole = 'super' | 'org-level-creator' | ...;
export type ProjectRole = 'owner' | 'creator' | 'editor' | ...;

// types/entities.ts
export interface BaseEntity { id: string; created_at: Date; updated_at: Date; }
export interface User extends BaseEntity { ... }
export interface UserCreateInput { ... }  // NEW
export interface UserUpdateInput { ... }  // NEW

// types/acl.ts
export const PROJECT_ACL: Acl<ProjectRole> = { ... };
export function hasPermission(role: ProjectRole, op: AclOperation): boolean;
export function canWrite(role: ProjectRole): boolean;

// types/request.ts
export interface RequestContext { user?: User; projectId?: string; ... }
export interface PaginatedResponse<T> { list: T[]; pageInfo: {...}; }
export function parseListQuery(query: ListQueryParams): ListOptions;
```

---

## 2. Models Optimization

### 2.1 Issues Identified

#### A. Repetitive Code Pattern
Every model repeated the same CRUD pattern:

```typescript
// This pattern was repeated in User, Project, Page, Flow...
static async get(id: string, options?: TableOptions): Promise<User | null> {
  const data = await getById<UserType>(CACHE_SCOPE, META_TABLE, id, options);
  return data ? new User(data) : null;
}

static async update(id: string, data: Partial<...>, options?: TableOptions): Promise<void> {
  await updateRecord<UserType>(CACHE_SCOPE, META_TABLE, id, data, options);
}
```

#### B. Inconsistent Cache Key Building
```typescript
// Sometimes uses helper
const key = buildCacheKey({ scope, id });

// Sometimes manual
const cacheKey = `${CACHE_SCOPE}:${id}`;
```

### 2.2 Implemented Optimizations

#### A. BaseModel Abstract Class

```typescript
// models/BaseModel.ts
export abstract class BaseModel<T extends BaseEntity> {
  protected data: T;
  
  protected abstract get scope(): CacheScope;
  protected abstract get table(): MetaTable;

  // Common getters
  get id(): string { return this.data.id; }
  get createdAt(): Date { return this.data.created_at; }
  getData(): T { return this.data; }
  toJSON(): T { return { ...this.data }; }

  // Static CRUD operations
  protected static async getById<T>(...): Promise<T | null>
  protected static async getByCondition<T>(...): Promise<T | null>
  protected static async listRecords<T>(...): Promise<T[]>
  protected static async insertRecord<T>(...): Promise<string>
  protected static async updateRecord<T>(...): Promise<void>
  protected static async deleteRecord(...): Promise<number>
  protected static async countRecords(...): Promise<number>
}
```

#### B. Standardized Cache Key Builder

```typescript
// models/BaseModel.ts
export const CacheKey = {
  entity: (scope: CacheScope, id: string) => `${scope}:${id}`,
  list: (scope: CacheScope, key: string) => `${scope}:list:${key}`,
  index: (scope: CacheScope, field: string, value: string) => 
    `${scope}:${field}:${value}`,
  pattern: (scope: CacheScope) => `${scope}:*`,
};
```

### 2.3 Example: Optimized Model

```typescript
// Before: 180+ lines with repetitive code
// After: Clean, focused implementation

class User extends BaseModel<UserType> {
  protected get scope() { return CacheScope.USER; }
  protected get table() { return MetaTable.USERS; }

  get email(): string { return this.data.email; }
  get displayName(): string { ... }

  static async get(id: string, options?: ModelOptions): Promise<User | null> {
    const data = await this.getById<UserType>(
      CacheScope.USER, MetaTable.USERS, id, options
    );
    return data ? new User(data) : null;
  }

  static async create(input: UserCreateInput, options?: ModelOptions): Promise<User> {
    // Type-safe input with UserCreateInput
    const id = await this.insertRecord<UserType>(...);
    return (await this.get(id))!;
  }
}
```

---

## 3. Cache Optimization

### 3.1 Issues Identified

#### A. Inconsistent Key Patterns
Cache keys were built differently across the codebase.

#### B. No Metrics Collection
No visibility into cache performance (hit rate, latency).

#### C. WriteBehindCache Memory Leak
The `pending` Map could grow unbounded if flush repeatedly failed.

### 3.2 Implemented Optimizations

#### A. Cache Key Module (`cache/keys.ts`)

```typescript
export const CacheKeys = {
  entity: (scope, id) => `${scope}:${id}`,
  list: (scope, key) => `${scope}:list:${key}`,
  index: (scope, field, value) => `${scope}:${field}:${value}`,
  userList: (scope, userId) => `${scope}:user:${userId}`,
  projectResource: (scope, projectId, resourceId?) => ...,
  scopePattern: (scope) => `${scope}:*`,
};

// Parsing utility
export function parseCacheKey(key: string): CacheKeyParts;
```

#### B. Cache Metrics Module (`cache/metrics.ts`)

```typescript
export const cacheMetrics = {
  recordHit(scope?: string, latencyMs?: number): void;
  recordMiss(scope?: string, latencyMs?: number): void;
  recordSet(): void;
  recordDelete(): void;
  
  getMetrics(): CacheMetrics;
  getScopeMetrics(): ScopeMetrics[];
  getSummary(): string;
  reset(): void;
};

// Decorator functions for wrapping operations
export async function withGetMetrics<T>(scope, operation): Promise<T | null>;
export async function withSetMetrics<T>(operation): Promise<T>;
```

---

## 4. File Structure After Optimization

```
packages/platform-server/src/
├── types/
│   ├── index.ts        # Clean barrel export
│   ├── enums.ts        # CacheScope, MetaTable, role types
│   ├── entities.ts     # Entity interfaces + input types
│   ├── acl.ts          # Permissions with helper functions
│   └── request.ts      # API types with helper functions
├── models/
│   ├── index.ts        # Exports BaseModel + all models
│   ├── BaseModel.ts    # Abstract base class + CacheKey
│   ├── Table.ts        # Legacy helpers (backward compat)
│   ├── User.ts
│   ├── Project.ts
│   ├── Page.ts
│   └── Flow.ts
└── cache/
    ├── index.ts        # Main exports
    ├── helpers.ts      # Cache patterns (cacheAside, etc.)
    ├── keys.ts         # Standardized key builders
    └── metrics.ts      # Performance metrics collector
```

---

## 5. Benefits

### Type Safety
- Dedicated input types prevent accidental inclusion of system fields
- ACL helpers provide type-safe permission checking
- Request helpers ensure consistent pagination

### Code Reduction
- BaseModel eliminates ~60% of repetitive CRUD code
- Standardized cache keys prevent copy-paste errors
- Helper functions reduce boilerplate

### Observability
- Cache metrics show hit rate and latency
- Per-scope metrics help identify problem areas
- Summary function for quick debugging

### Maintainability
- Domain-organized files are easier to navigate
- Single source of truth for each concept
- Clear separation of concerns

---

## 6. Migration Notes

### Backward Compatibility
All existing exports are maintained:
- `types/index.ts` re-exports everything
- Legacy `Table.ts` helpers still available
- Old `buildCacheKey` still exported

### Gradual Adoption
Models can be migrated one at a time:
1. Keep existing model working
2. Create new model extending BaseModel
3. Test thoroughly
4. Replace old model

### Usage Examples

```typescript
// Old way (still works)
import { CacheScope, MetaTable, User } from '../types';
const key = `${CacheScope.USER}:${id}`;

// New way (recommended)
import { CacheScope, MetaTable, type User, type UserCreateInput } from '../types';
import { CacheKeys, cacheMetrics } from '../cache';

const key = CacheKeys.entity(CacheScope.USER, id);
const data = await withGetMetrics(CacheScope.USER, () => cache.get(key));
console.log(cacheMetrics.getSummary());
```

---

## 7. Next Steps

### Immediate
- [x] Split types into domain files
- [x] Create BaseModel class
- [x] Add cache key builders
- [x] Add cache metrics

### Future Improvements
- [ ] Migrate existing models to extend BaseModel
- [ ] Add cache metrics to health endpoint
- [ ] Add cache warming on startup
- [ ] Consider Redis cluster support

---

*Document Version: 1.0*
*Created: December 2024*
*Package: platform-server*
