# Platform Server

> 低代码平台后端服务，基于 Express.js + AgentDB

版本: 0.98.3

## 概述

`platform-server` 是一个低代码平台的后端服务，提供项目管理、数据建模、应用构建、工作流引擎等核心能力。

### 技术栈

- **Express.js** - Web 框架
- **AgentDB** - 数据层 (基于 JSONB 的动态模式)
- **PostgreSQL** - 数据库
- **Redis** - 缓存 (可选)
- **Passport.js + JWT** - 认证
- **Socket.IO** - 实时通信 (可选)

## 快速开始

### 环境变量

```bash
# 必需
META_SERVER_DB=postgres://user:pass@localhost:5432/platform_meta
NC_AUTH_JWT_SECRET=your-secret-key

# 可选
DATA_SERVER_DB=postgres://user:pass@localhost:5432/platform_data
REDIS_URL=redis://localhost:6379
PORT=8080
```

### 启动服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

### 编程式使用

```typescript
import { App } from '@workspace/platform-server';

const app = App.getInstance({
  metaDbUrl: 'postgres://localhost:5432/platform',
  auth: {
    jwtSecret: 'your-secret',
  },
});

await app.listen(8080);
```

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端 (Web/Mobile/API)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      App.ts (应用入口 - 单例)                        │
│  • 中间件配置 • 数据库迁移 • JWT 认证 • API 路由注册                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│    Meta API 层         │ │   Data API 层   │ │   User API 层       │
│  projectApis/tableApis │ │   (agentdb)     │ │   userApis/auth     │
│  appApis/flowAppApis   │ │                 │ │                     │
└───────────────────────┘ └─────────────────┘ └─────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        模型层 (Models)                               │
│  Project │ Database │ User │ AppModel │ Page │ FlowApp │ Flow      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌──────────────────────────────┐
│       NcMetaIO (元数据)        │   │      NocoCache (缓存)        │
│  metaInsert/Update/Delete/Get │   │  Redis / In-Memory           │
└───────────────────────────────┘   └──────────────────────────────┘
```

## API 路由

| 模块 | 路径 | 描述 |
|------|------|------|
| Auth | `POST /api/v1/db/auth/signup` | 用户注册 |
| Auth | `POST /api/v1/db/auth/signin` | 用户登录 |
| Auth | `POST /api/v1/db/auth/token/refresh` | 刷新令牌 |
| User | `GET /api/v1/db/users/me` | 获取当前用户 |
| Project | `GET/POST /api/v1/db/meta/projects` | 项目列表/创建 |
| Project | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id` | 项目详情/更新/删除 |
| Table | `GET/POST /api/v1/db/meta/projects/:id/tables` | 表列表/创建 |
| Table | `POST /api/v1/db/meta/projects/:id/tables/:id/columns` | 添加列 |
| App | `GET/POST /api/v1/db/meta/projects/:id/apps` | 应用列表/创建 |
| Page | `GET/POST /api/v1/db/meta/apps/:id/pages` | 页面列表/创建 |
| Flow | `GET/POST /api/v1/db/meta/projects/:id/flows` | 工作流列表/创建 |
| Data | `GET/POST /api/v1/db/data/:projectId/:tableName` | 数据 CRUD |

## 核心模型

### Project (项目)

```typescript
interface Project {
  id: string;
  title: string;
  prefix: string;
  description?: string;
  org_id?: string;
  deleted: boolean;
  meta?: Record<string, unknown>;
}
```

### Database (数据库连接)

```typescript
interface Database {
  id: string;
  project_id: string;
  type: 'pg' | 'mysql' | 'sqlite';
  is_default_data_server_db: boolean;
  config?: string; // 加密的连接配置
}
```

### AppModel (应用)

```typescript
interface AppModel {
  id: string;
  project_id: string;
  title: string;
  type: 'page' | 'flow' | 'dashboard' | 'form';
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
}
```

## 缓存策略

### 读取模式 (Cache-Aside)

```typescript
// 1. 查缓存
const cached = await NocoCache.get(CacheScope.PROJECT, id);
if (cached) return cached;

// 2. 查数据库
const data = await ncMeta.metaGet2(...);

// 3. 写入缓存
await NocoCache.set(CacheScope.PROJECT, id, data);
```

### 写入模式 (Write-Through)

```typescript
// 1. 更新数据库
await ncMeta.metaUpdate(...);

// 2. 更新缓存
await NocoCache.set(CacheScope.PROJECT, id, updatedData);
```

## 认证流程

```
登录请求 (email + password)
     │
     ├── 1. 验证用户凭据 (bcrypt)
     │
     ├── 2. 生成 JWT Token
     │       └── payload: { id, email, roles }
     │       └── expiresIn: 10h
     │
     └── 返回 { token, user }

后续请求 (携带 JWT)
     │
     ├── 1. Passport JWT Strategy 验证
     │
     ├── 2. User.get(payload.id) 加载用户
     │
     ├── 3. 注入 req.user
     │
     └── ACL 检查 (projectAcl[role][operation])
```

### 角色权限

| 角色 | 读取 | 创建 | 更新 | 删除 | 发布 | 邀请 |
|------|------|------|------|------|------|------|
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| creator | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| editor | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

## 数据库迁移

迁移会自动在启动时执行，创建以下表：

- `nc_users` - 用户
- `nc_orgs` / `nc_org_users` - 组织
- `nc_projects` / `nc_project_users` - 项目
- `nc_bases` - 数据库连接
- `nc_apps` - 应用
- `nc_pages` - 页面
- `nc_flow_apps` / `nc_flows` - 工作流
- `nc_schemas` - Schema 数据存储
- `nc_publish_states` - 发布状态

## 与 AgentDB 集成

platform-server 使用 AgentDB 作为数据层：

1. **Schema 管理** - 使用 `SchemaManager` 管理表/列定义
2. **数据 CRUD** - 使用 `createRestApi` 提供数据操作 API
3. **动态模式** - 表结构以 JSONB 存储，支持灵活的列类型

```typescript
import { SchemaManager, createRestApi } from '@workspace/agentdb';

// 创建表
const schema = new SchemaManager({ db, namespace: 'project:123' });
await schema.createTable({
  title: 'Users',
  columns: [
    { title: 'Name', uidt: 'SingleLineText' },
    { title: 'Email', uidt: 'Email' },
  ],
});

// 数据 API 自动可用
// GET /api/v1/db/data/123/users
```

## 开发

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 构建
pnpm build

# 类型检查
pnpm tsc --noEmit
```

## License

MIT
