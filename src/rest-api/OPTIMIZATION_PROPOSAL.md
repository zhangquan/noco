# REST API 优化方案

## 概述

本方案旨在对 AgentDB REST API 模块进行全面重构，使其更加专业、简洁、逻辑清晰。

---

## 一、架构优化

### 1.1 当前问题

```
rest-api/
├── index.ts              # 入口混杂了工厂函数和导出
├── types.ts              # 类型定义分散
├── middleware.ts         # 中间件职责不清
├── helpers.ts            # 工具函数过多过杂
└── dataApis/             # 命名不规范 ("dataAlias" 无意义)
    ├── dataAliasApis.ts
    ├── dataAliasNestedApis.ts
    ├── bulkDataAliasApis.ts
    └── ...
```

### 1.2 目标架构

```
rest-api/
├── index.ts                    # 纯导出入口
├── router.ts                   # 路由工厂 (职责单一)
├── config.ts                   # 配置中心
├── types/
│   ├── index.ts
│   ├── request.ts              # 请求相关类型
│   ├── response.ts             # 响应相关类型
│   └── params.ts               # 参数相关类型
├── middleware/
│   ├── index.ts
│   ├── context.ts              # 上下文注入
│   ├── auth.ts                 # 认证授权
│   ├── validation.ts           # 参数校验
│   └── error.ts                # 错误处理
├── handlers/                   # 路由处理器 (替代 dataApis)
│   ├── index.ts
│   ├── records.ts              # 单记录 CRUD
│   ├── bulk.ts                 # 批量操作
│   ├── relations.ts            # 关系操作
│   ├── export.ts               # 导出功能
│   ├── schema.ts               # Schema 查询
│   └── public.ts               # 公开访问
├── services/                   # 业务逻辑层 (新增)
│   ├── index.ts
│   ├── RecordService.ts
│   ├── BulkService.ts
│   ├── RelationService.ts
│   └── ExportService.ts
└── utils/
    ├── index.ts
    ├── parser.ts               # 参数解析
    ├── serializer.ts           # 数据序列化
    └── response.ts             # 响应构建
```

---

## 二、命名规范优化

### 2.1 文件命名

| 当前命名 | 优化后 | 说明 |
|---------|--------|------|
| `dataAliasApis.ts` | `records.ts` | 语义清晰 |
| `dataAliasNestedApis.ts` | `relations.ts` | 职责明确 |
| `bulkDataAliasApis.ts` | `bulk.ts` | 简洁直观 |
| `dataAliasExportApis.ts` | `export.ts` | 功能导向 |

### 2.2 函数命名

| 当前命名 | 优化后 | 说明 |
|---------|--------|------|
| `getDataList` | `listRecords` | 动词+名词 |
| `dataRowRead` | `getRecord` | 简洁清晰 |
| `dataInsertFun` | `createRecord` | RESTful 风格 |
| `dataUpdateFun` | `updateRecord` | 一致性 |
| `dataDeleteFun` | `deleteRecord` | 一致性 |
| `dataExistFun` | `checkExists` | 语义准确 |
| `mmListFun` | `listLinkedRecords` | 可读性强 |
| `relationDataAddFun` | `linkRecords` | 简洁 |
| `relationDataRemoveFun` | `unlinkRecords` | 简洁 |
| `bulkInsertFun` | `bulkCreate` | RESTful 风格 |
| `ncMetaAclMw` | `authorize` | 语义清晰 |

### 2.3 路由命名

| 当前路由 | 优化后 | 说明 |
|---------|--------|------|
| `/:tableName/:rowId/exist` | `/:tableName/:rowId/exists` | 语法正确 |
| `/:tableName/:rowId/mm/:columnName` | `/:tableName/:rowId/links/:columnName` | 统一 links |
| `/:tableName/:rowId/hm/:columnName` | `/:tableName/:rowId/links/:columnName` | 统一 links |
| `/:tableName/:rowId/bt/:columnName` | `/:tableName/:rowId/links/:columnName` | 统一 links |
| `/bulk/:tableName/clearAll` | `/bulk/:tableName/truncate` | 语义准确 |

---

## 三、代码结构优化

### 3.1 引入 Service 层

**目的**: 分离业务逻辑与 HTTP 处理，提高可测试性和复用性。

```typescript
// services/RecordService.ts
export class RecordService {
  constructor(private ctx: RequestContext) {}

  async list(args: ListArgs): Promise<PagedResult<Record>> {
    const model = this.createModel();
    const [records, count] = await Promise.all([
      model.list(args),
      model.count(args),
    ]);
    return { records, total: count, ...this.buildPageInfo(args, count) };
  }

  async getById(id: string, fields?: string[]): Promise<Record> {
    const model = this.createModel();
    const record = await model.readByPk(id, fields);
    if (!record) throw new NotFoundError(`Record ${id} not found`);
    return record;
  }

  async create(data: RecordInput): Promise<Record> {
    const model = this.createModel();
    return model.insert(data, undefined, this.ctx.cookie);
  }

  async update(id: string, data: Partial<RecordInput>): Promise<Record> {
    const model = this.createModel();
    return model.updateByPk(id, data, undefined, this.ctx.cookie);
  }

  async delete(id: string): Promise<void> {
    const model = this.createModel();
    await model.deleteByPk(id, undefined, this.ctx.cookie);
  }

  private createModel() {
    return createModel({
      db: this.ctx.db,
      tableId: this.ctx.tableId,
      tables: this.ctx.tables,
    });
  }
}
```

### 3.2 简化 Handler 层

```typescript
// handlers/records.ts
import { RecordService } from '../services';
import { parseListArgs, buildPagedResponse, ok, created } from '../utils';

export const listRecords = handler(async (req, res) => {
  const service = new RecordService(req.context);
  const args = parseListArgs(req.query);
  const result = await service.list(args);
  return ok(res, buildPagedResponse(result));
});

export const getRecord = handler(async (req, res) => {
  const service = new RecordService(req.context);
  const record = await service.getById(req.params.rowId);
  return ok(res, record);
});

export const createRecord = handler(async (req, res) => {
  const service = new RecordService(req.context);
  const record = await service.create(req.body);
  return created(res, record);
});

export const updateRecord = handler(async (req, res) => {
  const service = new RecordService(req.context);
  const record = await service.update(req.params.rowId, req.body);
  return ok(res, record);
});

export const deleteRecord = handler(async (req, res) => {
  const service = new RecordService(req.context);
  await service.delete(req.params.rowId);
  return ok(res, { deleted: true });
});
```

### 3.3 统一路由注册

```typescript
// router.ts
import { Router } from 'express';
import * as records from './handlers/records';
import * as bulk from './handlers/bulk';
import * as relations from './handlers/relations';
import * as schema from './handlers/schema';
import * as exportHandler from './handlers/export';
import { auth, validate, errorHandler } from './middleware';

export function createRouter(config: RouterConfig = {}): Router {
  const router = Router();

  // Schema routes (无需认证)
  router.get('/tables', records.listTables);
  router.get('/:tableName/schema', schema.describe);

  // Record CRUD
  router.route('/:tableName')
    .get(auth('read'), records.listRecords)
    .post(auth('create'), validate.body('object'), records.createRecord);

  router.route('/:tableName/:rowId')
    .get(auth('read'), records.getRecord)
    .patch(auth('update'), validate.body('object'), records.updateRecord)
    .delete(auth('delete'), records.deleteRecord);

  router.get('/:tableName/:rowId/exists', auth('read'), records.checkExists);
  router.get('/:tableName/find-one', auth('read'), records.findOne);
  router.get('/:tableName/count', auth('read'), records.count);
  router.get('/:tableName/groupby', auth('read'), records.groupBy);

  // Bulk operations
  router.route('/bulk/:tableName')
    .post(auth('bulkCreate'), validate.body('array'), bulk.create)
    .patch(auth('bulkUpdate'), validate.body('array'), bulk.update)
    .delete(auth('bulkDelete'), bulk.delete);

  router.patch('/bulk/:tableName/all', auth('bulkUpdate'), bulk.updateAll);
  router.delete('/bulk/:tableName/all', auth('bulkDelete'), bulk.deleteAll);
  router.delete('/bulk/:tableName/truncate', auth('bulkDelete'), bulk.truncate);
  router.post('/bulk/:tableName/write', auth('bulkCreate'), bulk.write);

  // Relations
  router.get('/:tableName/:rowId/links/:columnName', auth('read'), relations.list);
  router.get('/:tableName/:rowId/links/:columnName/available', auth('read'), relations.listAvailable);
  router.post('/:tableName/:rowId/links/:columnName', auth('link'), validate.body('array'), relations.link);
  router.delete('/:tableName/:rowId/links/:columnName', auth('unlink'), relations.unlink);

  // Export (可选)
  if (config.enableExport !== false) {
    router.get('/:tableName/export', auth('export'), exportHandler.export);
    router.get('/:tableName/export/:format', auth('export'), exportHandler.exportAs);
  }

  // Error handler
  router.use(errorHandler);

  return router;
}
```

---

## 四、中间件优化

### 4.1 简化 Context 中间件

```typescript
// middleware/context.ts
export function injectContext(db: Knex, tables: Table[]) {
  return (req: ApiRequest, res: Response, next: NextFunction) => {
    const tableName = req.params.tableName;
    const table = tableName 
      ? tables.find(t => t.id === tableName || t.title === tableName)
      : undefined;

    req.context = {
      db,
      tables,
      table,
      tableId: table?.id,
      user: req.user,
      cookie: {
        user: req.user,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    };
    
    next();
  };
}
```

### 4.2 简化 Auth 中间件

```typescript
// middleware/auth.ts
type Action = 'read' | 'create' | 'update' | 'delete' | 'bulkCreate' | 'bulkUpdate' | 'bulkDelete' | 'link' | 'unlink' | 'export';

export function auth(action: Action) {
  return async (req: ApiRequest, res: Response, next: NextFunction) => {
    // 读操作允许匿名访问 (可配置)
    if (action === 'read' && !req.user) {
      return next();
    }

    // 其他操作需要认证
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // 权限检查 (可扩展)
    const hasPermission = await checkPermission(req.user, action, req.context.table);
    if (!hasPermission) {
      throw new ForbiddenError(`Permission denied: ${action}`);
    }

    next();
  };
}
```

### 4.3 统一错误处理

```typescript
// middleware/error.ts
export function errorHandler(
  error: Error,
  req: ApiRequest,
  res: Response,
  next: NextFunction
) {
  // 已发送响应则跳过
  if (res.headersSent) return next(error);

  // 日志记录
  logger.error({ error, path: req.path, method: req.method });

  // 标准化错误响应
  const response = normalizeError(error);
  res.status(response.status).json(response);
}

function normalizeError(error: Error): ErrorResponse {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  // 未知错误
  return {
    status: 500,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
    },
  };
}
```

---

## 五、类型系统优化

### 5.1 请求类型

```typescript
// types/request.ts
export interface ApiRequest extends Request {
  context: RequestContext;
  user?: AuthUser;
}

export interface RequestContext {
  db: Knex;
  tables: Table[];
  table?: Table;
  tableId?: string;
  viewId?: string;
  cookie: RequestCookie;
}

export interface RequestCookie {
  user?: { id: string; email?: string; displayName?: string };
  ip?: string;
  userAgent?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  roles?: string[];
}
```

### 5.2 响应类型

```typescript
// types/response.ts
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: ResponseMeta;
}

export interface PagedResponse<T = unknown> {
  list: T[];
  pageInfo: PageInfo;
}

export interface PageInfo {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BulkResult {
  success: boolean;
  affected: number;
  ids?: string[];
  errors?: BulkError[];
}

export interface BulkError {
  index: number;
  message: string;
  code?: string;
}

export interface ErrorResponse {
  status: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### 5.3 参数类型

```typescript
// types/params.ts
export interface ListParams {
  offset?: number;
  limit?: number;
  fields?: string[];
  sort?: string;
  filter?: FilterObject;
  filterArr?: Filter[];
}

export interface FilterObject {
  [field: string]: FilterValue;
}

export type FilterValue = 
  | string 
  | number 
  | boolean 
  | null
  | { eq?: unknown; ne?: unknown; gt?: number; gte?: number; lt?: number; lte?: number; like?: string; in?: unknown[]; notIn?: unknown[]; isNull?: boolean };

export interface RouteParams {
  tableName: string;
  rowId?: string;
  columnName?: string;
  format?: 'csv' | 'xlsx';
}
```

---

## 六、响应格式统一

### 6.1 响应工具函数

```typescript
// utils/response.ts
export function ok<T>(res: Response, data: T): void {
  res.status(200).json(data);
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function noContent(res: Response): void {
  res.status(204).end();
}

export function paginate<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number
): PagedResponse<T> {
  return {
    list,
    pageInfo: {
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  };
}

export function bulkResult(
  affected: number,
  ids?: string[],
  errors?: BulkError[]
): BulkResult {
  return {
    success: !errors?.length,
    affected,
    ids,
    errors,
  };
}
```

### 6.2 统一响应结构

```typescript
// 列表查询
{
  "list": [...],
  "pageInfo": {
    "total": 100,
    "page": 1,
    "pageSize": 25,
    "hasNext": true,
    "hasPrev": false
  }
}

// 单条记录
{
  "id": "...",
  "field1": "value1",
  ...
}

// 批量操作
{
  "success": true,
  "affected": 10,
  "ids": ["id1", "id2", ...]
}

// 错误响应
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Record not found",
    "details": { "id": "xxx" }
  }
}
```

---

## 七、配置中心化

```typescript
// config.ts
export interface RestApiConfig {
  // 路由配置
  basePath: string;
  enablePublicApi: boolean;
  enableExportApi: boolean;

  // 分页配置
  defaultPageSize: number;
  maxPageSize: number;

  // 批量操作配置
  maxBulkSize: number;
  bulkChunkSize: number;

  // 导出配置
  maxExportRows: number;
  exportTimeout: number;

  // 安全配置
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;

  // 认证配置
  allowAnonymousRead: boolean;
}

export const defaultConfig: RestApiConfig = {
  basePath: '/api/v1/data',
  enablePublicApi: true,
  enableExportApi: true,

  defaultPageSize: 25,
  maxPageSize: 1000,

  maxBulkSize: 1000,
  bulkChunkSize: 100,

  maxExportRows: 10000,
  exportTimeout: 30000,

  enableRateLimit: true,
  rateLimitWindow: 60000,
  rateLimitMax: 100,

  allowAnonymousRead: true,
};

export function createConfig(overrides?: Partial<RestApiConfig>): RestApiConfig {
  return { ...defaultConfig, ...overrides };
}
```

---

## 八、路由优化

### 8.1 RESTful 路由设计

```
# Schema & Meta
GET    /tables                              # 获取所有表
GET    /:tableName/schema                   # 获取表 Schema

# Records CRUD
GET    /:tableName                          # 列表查询
POST   /:tableName                          # 创建记录
GET    /:tableName/:rowId                   # 获取记录
PATCH  /:tableName/:rowId                   # 更新记录
DELETE /:tableName/:rowId                   # 删除记录

# Record Utilities
GET    /:tableName/:rowId/exists            # 检查存在
GET    /:tableName/find-one                 # 查询单条
GET    /:tableName/count                    # 统计数量
GET    /:tableName/groupby                  # 分组统计

# Bulk Operations
POST   /bulk/:tableName                     # 批量创建
PATCH  /bulk/:tableName                     # 批量更新 (by IDs)
PATCH  /bulk/:tableName/all                 # 批量更新 (by filter)
DELETE /bulk/:tableName                     # 批量删除 (by IDs)
DELETE /bulk/:tableName/all                 # 批量删除 (by filter)
DELETE /bulk/:tableName/truncate            # 清空表
POST   /bulk/:tableName/write               # 混合批量操作

# Relations
GET    /:tableName/:rowId/links/:column     # 获取关联记录
GET    /:tableName/:rowId/links/:column/available  # 获取可关联记录
POST   /:tableName/:rowId/links/:column     # 添加关联
DELETE /:tableName/:rowId/links/:column     # 移除关联

# Export
GET    /:tableName/export                   # 导出 (format=csv|xlsx)
GET    /:tableName/export/csv               # 导出 CSV
GET    /:tableName/export/xlsx              # 导出 Excel

# Public API (Shared Views)
GET    /shared/:viewId                      # 公开视图列表
POST   /shared/:viewId                      # 公开表单提交
GET    /shared/:viewId/:rowId               # 公开记录详情
```

### 8.2 移除冗余路由

| 移除路由 | 理由 |
|---------|------|
| `/:tableName/views/:viewName` | 合并到主查询，view 作为查询参数 |
| `/:tableName/:rowId/mm/:col` | 统一为 `/links/:col` |
| `/:tableName/:rowId/hm/:col` | 统一为 `/links/:col` |
| `/:tableName/:rowId/bt/:col` | 统一为 `/links/:col` |
| `/:tableName/:rowId/:relType/:col/:refRowId` | 简化为 POST/DELETE `/links/:col` |

---

## 九、错误处理优化

### 9.1 统一错误类

```typescript
// core/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'BAD_REQUEST', 400, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Permission denied') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}
```

### 9.2 错误码规范

| 错误码 | HTTP 状态 | 说明 |
|-------|----------|------|
| `BAD_REQUEST` | 400 | 请求参数错误 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `FORBIDDEN` | 403 | 无权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `VALIDATION_ERROR` | 422 | 数据验证失败 |
| `RATE_LIMIT` | 429 | 请求过于频繁 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 十、测试策略

### 10.1 测试结构

```
tests/
├── unit/
│   ├── services/
│   │   ├── RecordService.test.ts
│   │   ├── BulkService.test.ts
│   │   └── RelationService.test.ts
│   ├── middleware/
│   │   ├── auth.test.ts
│   │   └── validation.test.ts
│   └── utils/
│       ├── parser.test.ts
│       └── serializer.test.ts
├── integration/
│   ├── records.test.ts
│   ├── bulk.test.ts
│   ├── relations.test.ts
│   └── export.test.ts
└── e2e/
    └── api.test.ts
```

### 10.2 测试覆盖要求

- 单元测试覆盖率 > 80%
- 集成测试覆盖所有 API 端点
- E2E 测试覆盖核心用户流程

---

## 十一、实施计划

### Phase 1: 基础重构 (优先级: 高)
1. 重组目录结构
2. 引入 Service 层
3. 统一命名规范
4. 优化类型定义

### Phase 2: 功能优化 (优先级: 中)
1. 简化中间件
2. 统一响应格式
3. 完善错误处理
4. 配置中心化

### Phase 3: 路由优化 (优先级: 中)
1. 整合冗余路由
2. 统一 RESTful 风格
3. 优化参数解析

### Phase 4: 质量保障 (优先级: 高)
1. 补充单元测试
2. 添加集成测试
3. 完善 API 文档

---

## 十二、兼容性处理

### 12.1 废弃路由处理

```typescript
// 提供废弃提示中间件
function deprecated(newPath: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Deprecated', `Use ${newPath} instead`);
    console.warn(`[DEPRECATED] ${req.method} ${req.path} -> ${newPath}`);
    next();
  };
}

// 临时保留旧路由，添加废弃提示
router.get('/:tableName/:rowId/mm/:col', deprecated('/links/:col'), legacyMmList);
```

### 12.2 版本控制

```typescript
// 建议引入 API 版本控制
app.use('/api/v1', v1Router);  // 当前版本
app.use('/api/v2', v2Router);  // 重构后版本
```

---

## 十三、性能优化建议

### 13.1 查询优化
- 支持字段选择 (`fields` 参数)
- 支持分页预加载 (`prefetch`)
- 批量操作使用事务

### 13.2 缓存策略
- Schema 信息缓存
- 高频查询结果缓存
- ETag 支持

### 13.3 连接池
- 合理配置数据库连接池
- 请求级连接复用

---

## 总结

本优化方案的核心目标:

1. **专业性**: 分层架构、统一规范、完善测试
2. **简洁性**: 减少冗余代码、统一模式、清晰命名
3. **逻辑清晰**: 职责分离、流程明确、文档完善

预期收益:
- 代码可维护性提升 50%+
- 新功能开发效率提升 30%+
- Bug 发生率降低 40%+
- 团队协作效率提升
