# AgentDB REST API

完整的 RESTful API 模块，用于数据的 CRUD 操作、关联数据处理和数据导出。

## 目录结构

```
rest-api/
├── index.ts                    # 主入口，导出 dataApis 和工厂函数
├── types.ts                    # REST API 类型定义
├── helpers.ts                  # 公共辅助函数
├── middleware.ts               # 中间件 (ACL, 错误处理, 限流等)
└── dataApis/
    ├── index.ts                # dataApis 模块入口
    ├── dataAliasApis.ts        # 核心数据 CRUD API
    ├── bulkDataAliasApis.ts    # 批量数据操作 API
    ├── dataAliasNestedApis.ts  # 嵌套/关联数据 API
    ├── dataAliasExportApis.ts  # 数据导出 API (CSV/Excel)
    └── public/                 # 公开访问 API (SharedView)
        ├── index.ts
        └── dataAliasApis.ts
```

## 快速开始

### 基本用法

```typescript
import express from 'express';
import knex from 'knex';
import { registerRestApi } from 'agentdb';

const app = express();
const db = knex({ client: 'pg', connection: '...' });

// 定义表结构
const tables = [
  {
    id: 'users',
    title: 'Users',
    columns: [
      { id: 'name', title: 'Name', uidt: 'SingleLineText' },
      { id: 'email', title: 'Email', uidt: 'Email' },
    ],
  },
  // ... 更多表
];

// 注册完整的 REST API
const apiRouter = registerRestApi({
  db,
  tables,
  basePath: '/api/v1/db/data',
  enablePublicApis: true,
  enableExportApis: true,
});

app.use(express.json());
app.use(apiRouter);
app.listen(3000);
```

### 分离的路由器用法

```typescript
import express from 'express';
import { registerDataRouter, createDbContextMiddleware } from 'agentdb';

const app = express();
const router = registerDataRouter({
  enablePublicApis: true,
  enableExportApis: true,
  enableCors: true,
});

// 手动配置数据库上下文
app.use(createDbContextMiddleware(db, tables));
app.use('/api/v1/db/data', router);
```

## API 端点

### 核心 CRUD API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/:tableName` | 获取数据列表 |
| POST | `/:tableName` | 新增数据 |
| GET | `/:tableName/:rowId` | 获取单条数据 |
| PATCH | `/:tableName/:rowId` | 更新数据 |
| DELETE | `/:tableName/:rowId` | 删除数据 |
| GET | `/:tableName/find-one` | 查询单条 |
| GET | `/:tableName/count` | 获取总数 |
| GET | `/:tableName/groupby` | 分组统计 |
| GET | `/:tableName/:rowId/exist` | 检查存在 |
| GET | `/:tableName/describe` | 获取表结构 (AI友好) |
| GET | `/tables` | 获取所有表概览 |

### 批量操作 API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/bulk/:tableName` | 批量插入 |
| PATCH | `/bulk/:tableName` | 批量更新 |
| PATCH | `/bulk/:tableName/all` | 批量更新所有匹配项 |
| DELETE | `/bulk/:tableName` | 批量删除 |
| DELETE | `/bulk/:tableName/all` | 删除所有匹配项 |
| DELETE | `/bulk/:tableName/clearAll` | 清空表数据 |
| POST | `/bulk/:tableName/write` | 混合批量写入 (原子操作) |

### 关联数据 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/:tableName/:rowId/mm/:columnName` | 获取多对多关联数据 |
| GET | `/:tableName/:rowId/hm/:columnName` | 获取一对多关联数据 |
| GET | `/:tableName/:rowId/bt/:columnName` | 获取多对一关联数据 |
| GET | `/:tableName/:rowId/mm/:columnName/exclude` | 获取未关联的数据 |
| POST | `/:tableName/:rowId/:relationType/:columnName/:refRowId` | 添加关联 |
| DELETE | `/:tableName/:rowId/:relationType/:columnName/:refRowId` | 移除关联 |
| POST | `/:tableName/:rowId/links/:columnName` | 批量添加关联 |
| DELETE | `/:tableName/:rowId/links/:columnName` | 批量移除关联 |

### 导出 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/:tableName/export/csv` | 导出 CSV |
| GET | `/:tableName/export/excel` | 导出 Excel |
| GET | `/:tableName/export?format=csv` | 导出指定格式 |
| POST | `/:tableName/export` | 带选项导出 |

### 公开 API (SharedView)

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/shared-view/:sharedViewId` | 共享视图数据列表 |
| POST | `/shared-view/:sharedViewId` | 共享视图新增数据 |
| GET | `/shared-view/:sharedViewId/:rowId` | 共享视图单条数据 |

## 查询参数

### 标准查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `offset` | number | 偏移量 |
| `limit` | number | 每页数量 (默认 25, 最大 1000) |
| `where` | string | 条件过滤，格式: `(field,op,value)` |
| `fields` | string | 返回字段列表 (逗号分隔) |
| `sort` | string | 排序字段 (逗号分隔, `-` 前缀表示降序) |
| `filter` | object | 简化过滤对象 (JSON, AI友好) |
| `sortBy` | object | 简化排序对象 (JSON, AI友好) |

### AI 友好的过滤语法

```typescript
// 简化过滤
{
  "filter": {
    "status": "active",                    // 等于
    "age": { "gte": 18, "lt": 65 },        // 范围
    "name": { "like": "%john%" },          // 模糊匹配
    "tags": { "contains": "vip" }          // 数组包含
  }
}

// 简化排序
{
  "sortBy": {
    "created_at": "desc",
    "name": "asc"
  }
}
```

## 中间件

### 数据库上下文中间件

```typescript
import { createDbContextMiddleware } from 'agentdb';

app.use(createDbContextMiddleware(db, tables));
```

### 用户认证中间件

```typescript
import { createUserContextMiddleware } from 'agentdb';

app.use(createUserContextMiddleware(async (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return await verifyToken(token);
}));
```

### 限流中间件

```typescript
import { rateLimiter } from 'agentdb';

app.use(rateLimiter({
  windowMs: 60000,  // 1分钟
  maxRequests: 100, // 最多100请求
}));
```

### ACL 权限控制

```typescript
import { ncMetaAclMw, asyncHandler } from 'agentdb';

router.get('/data', ncMetaAclMw(asyncHandler(handler), 'handlerName', {
  action: 'read',
  check: async (user, table) => {
    // 自定义权限检查
    return user.roles.includes('admin');
  },
}));
```

## 业务函数复用

所有 API 端点的核心逻辑都抽取为独立的业务函数，可以在其他地方复用：

```typescript
import {
  getDataList,
  dataInsertFun,
  dataUpdateFun,
  bulkInsertFun,
  mmListFun,
  exportCsvFun,
} from 'agentdb';

// 在自定义路由中使用
app.get('/custom/users', async (req, res) => {
  const result = await getDataList(req, { lazyLoading: true });
  res.json(result);
});

// 在后台任务中使用
async function importData(req, data) {
  return await bulkInsertFun(req, data);
}
```

## 错误处理

使用统一的 `ModelError` 进行错误处理：

```typescript
import { ModelError, ErrorCode } from 'agentdb';

// 自动返回格式
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Record 'xxx' not found in 'Users'",
    "statusCode": 404,
    "details": { "id": "xxx", "tableName": "Users" }
  }
}
```

## 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Express Router                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
            │ Auth APIs   │ │ Public APIs │ │  Export APIs    │
            │ (认证用户)   │ │ (共享视图)   │ │  (CSV/Excel)    │
            └─────────────┘ └─────────────┘ └─────────────────┘
                    │               │
                    └───────┬───────┘
                            ▼
            ┌─────────────────────────────────┐
            │         helpers.ts              │
            │  - getTableFromRequest          │
            │  - createModelFromRequest       │
            │  - parseListArgs                │
            │  - createPagedResponse          │
            └─────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │        Model (agentdb)          │
            │  - list/insert/update/delete    │
            │  - mmList/mmLink/mmUnlink       │
            │  - bulkInsert/bulkUpdate        │
            │  - describeSchema               │
            └─────────────────────────────────┘
                            │
                            ▼
            ┌─────────────────────────────────┐
            │     PostgreSQL + JSONB          │
            └─────────────────────────────────┘
```

## 扩展

### 添加新的数据 API

```typescript
// 在 dataAliasApis.ts 中添加业务函数
export async function myCustomFun(req: AgentRequest): Promise<Record> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  // 自定义逻辑
  return model.findOne({ ... });
}

// 添加路由
router.get('/:tableName/custom', asyncHandler(async (req, res) => {
  const result = await myCustomFun(req);
  sendSuccess(res, result);
}));
```

### 添加新的导出格式

```typescript
// 在 dataAliasExportApis.ts 中添加
export async function exportPdfFun(req: AgentRequest): Promise<Buffer> {
  const ctx = getTableFromRequest(req);
  const model = createModelFromRequest(ctx);
  const records = await model.list({ ... });
  // 使用 PDF 库生成文档
  return pdfBuffer;
}
```

## 依赖关系

```
rest-api/
    ├── models/Model.ts      (数据模型)
    ├── types/               (类型定义)
    ├── core/NcError.ts      (错误处理)
    ├── utils/               (工具函数)
    └── config/              (配置)
```
