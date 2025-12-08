# Platform Server

> 低代码平台后端服务，基于 Express.js + AgentDB

版本: 1.0.0

## 概述

`platform-server` 是一个低代码平台的后端服务，提供项目管理、数据建模、应用构建、工作流引擎等核心能力。

### 技术栈

- **Express.js** - Web 框架
- **AgentDB** - 数据层 (基于 JSONB 的动态模式)
- **PostgreSQL** - 数据库
- **Redis** - 缓存 (可选)
- **Passport.js + JWT** - 认证
- **Zod** - 请求验证
- **Socket.IO** - 实时通信 (可选)

## 快速开始

### 环境变量

```bash
# 必需
DATABASE_URL=postgres://user:pass@localhost:5432/platform
NC_AUTH_JWT_SECRET=your-secret-key

# 可选
REDIS_URL=redis://localhost:6379
PORT=8080
NODE_ENV=production
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
  dbUrl: 'postgres://localhost:5432/platform',
  auth: {
    jwtSecret: 'your-secret',
    jwtExpiresIn: '1h',
  },
  enableLogging: true,
  enableRateLimit: true,
  trustProxy: true,
});

await app.listen(8080);
```

## 系统架构 (v1.0.0)

本版本对架构进行了全面优化，采用更标准化的分层设计：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端 (Web/Mobile/API)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        中间件层 (Middleware)                         │
│  • Request ID  • 日志  • CORS  • Helmet  • Rate Limit  • 验证       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       控制器层 (Controllers)                         │
│  AuthController │ UserController │ ProjectController                │
│  PageController │ FlowController │ TableController                  │
│                                                                     │
│  • 统一响应格式  • Zod 验证  • 错误处理  • 权限检查                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        服务层 (Services)                             │
│  UserService │ ProjectService │ PageService │ FlowService           │
│                                                                     │
│  • 业务逻辑封装  • 事务支持  • 缓存策略  • 权限验证                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        数据层 (Models/DAL)                           │
│  User │ Project │ Page │ Flow │ BaseService                        │
│                                                                     │
│  • ORM 抽象  • 缓存集成  • 软删除  • 审计追踪                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌──────────────────────────────┐
│       PostgreSQL (Knex)       │   │      NocoCache (缓存)        │
│  元数据/业务数据存储            │   │  Redis / In-Memory           │
└───────────────────────────────┘   └──────────────────────────────┘
```

### 新架构特点

#### 1. 标准化 API 响应格式

所有 API 返回统一格式：

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}

// 列表响应
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 25,
    "totalPages": 4,
    "hasMore": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Authentication required",
    "details": [...]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 2. 服务层抽象

```typescript
import { UserService, ProjectService, PageService, FlowService } from '@workspace/platform-server';

// 用户操作
const user = await UserService.signup({ email, password });
const authResult = await UserService.signin({ email, password });

// 项目操作
const project = await ProjectService.createProject({ title, description }, ownerId);
const projects = await ProjectService.listForUserPaginated(userId, page, pageSize);

// 页面操作
const page = await PageService.createPage({ project_id, title, route });
await PageService.reorder(projectId, orders);

// 工作流操作
const flow = await FlowService.createFlow({ project_id, title, trigger_type });
await FlowService.publish(flowId);
```

#### 3. 响应工具函数

```typescript
import { 
  sendSuccess, 
  sendCreated, 
  sendList, 
  parsePagination 
} from '@workspace/platform-server';

// 在控制器中使用
async function list(req, res, next) {
  const pagination = parsePagination(req.query);
  const result = await service.list(pagination.page, pagination.pageSize);
  
  sendList(res, result.data, {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}
```

#### 4. 基础服务类

创建新服务只需继承 `BaseService`：

```typescript
import { BaseService, CacheScope, MetaTable } from '@workspace/platform-server';

class MyService extends BaseService<MyEntity> {
  protected tableName = MetaTable.MY_TABLE;
  protected cacheScope = CacheScope.MY_SCOPE;
  protected entityName = 'MyEntity';
  
  // 自定义方法
  async customOperation(id: string) {
    const entity = await this.getByIdOrFail(id);
    // ...业务逻辑
    return this.update(id, changes);
  }
}
```

## API 路由

| 模块 | 路径 | 描述 |
|------|------|------|
| Health | `GET /health` | 健康检查 |
| Health | `GET /health/live` | 存活探针 |
| Health | `GET /health/ready` | 就绪探针 |
| Auth | `POST /api/v1/db/auth/signup` | 用户注册 |
| Auth | `POST /api/v1/db/auth/signin` | 用户登录 |
| Auth | `POST /api/v1/db/auth/token/refresh` | 刷新令牌 |
| Auth | `POST /api/v1/db/auth/password/forgot` | 忘记密码 |
| Auth | `POST /api/v1/db/auth/password/reset` | 重置密码 |
| User | `GET /api/v1/db/users/me` | 获取当前用户 |
| User | `PATCH /api/v1/db/users/me` | 更新个人信息 |
| User | `POST /api/v1/db/users/me/password` | 修改密码 |
| User | `GET /api/v1/db/users` | 用户列表 (管理员) |
| User | `GET/PATCH/DELETE /api/v1/db/users/:id` | 用户管理 (管理员) |
| Project | `GET/POST /api/v1/db/meta/projects` | 项目列表/创建 |
| Project | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id` | 项目详情/更新/删除 |
| Project | `GET/POST /api/v1/db/meta/projects/:id/users` | 项目成员管理 |
| Project | `PATCH/DELETE /api/v1/db/meta/projects/:id/users/:userId` | 成员角色/移除 |
| Table | `GET/POST /api/v1/db/meta/projects/:id/tables` | 表列表/创建 |
| Table | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id/tables/:tableId` | 表详情/更新/删除 |
| Table | `POST /api/v1/db/meta/projects/:id/tables/:tableId/columns` | 添加列 |
| Table | `PATCH/DELETE /api/v1/db/meta/projects/:id/tables/:tableId/columns/:colId` | 列更新/删除 |
| Table | `POST /api/v1/db/meta/projects/:id/tables/links` | 创建关联 |
| Table | `GET /api/v1/db/meta/projects/:id/tables/schema/export` | 导出Schema |
| Table | `POST /api/v1/db/meta/projects/:id/tables/schema/import` | 导入Schema |
| Table | `POST /api/v1/db/meta/projects/:id/tables/schema/save` | 保存Schema |
| Page | `GET/POST /api/v1/db/meta/projects/:id/pages` | 页面列表/创建 |
| Page | `GET /api/v1/db/meta/projects/:id/pages/by-route` | 按路由获取页面 |
| Page | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id/pages/:pageId` | 页面详情/更新/删除 |
| Page | `POST /api/v1/db/meta/projects/:id/pages/:pageId/save` | 保存页面 |
| Page | `POST /api/v1/db/meta/projects/:id/pages/:pageId/duplicate` | 复制页面 |
| Page | `POST /api/v1/db/meta/projects/:id/pages/reorder` | 页面排序 |
| Flow | `GET/POST /api/v1/db/meta/projects/:id/flows` | 工作流列表/创建 |
| Flow | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id/flows/:flowId` | 工作流详情/更新/删除 |
| Flow | `POST /api/v1/db/meta/projects/:id/flows/:flowId/save` | 保存工作流 |
| Flow | `POST /api/v1/db/meta/projects/:id/flows/:flowId/publish` | 发布工作流 |
| Flow | `POST /api/v1/db/meta/projects/:id/flows/:flowId/enable` | 启用工作流 |
| Flow | `POST /api/v1/db/meta/projects/:id/flows/:flowId/disable` | 禁用工作流 |
| Data | `GET/POST /api/v1/db/data/:projectId/:tableName` | 数据 CRUD |

## 错误码

| 分类 | 代码 | 说明 |
|------|------|------|
| 认证 | AUTH_001 | 需要认证 |
| 认证 | AUTH_002 | 凭据无效 |
| 认证 | AUTH_003 | 令牌过期 |
| 认证 | AUTH_004 | 令牌无效 |
| 认证 | AUTH_005 | 权限不足 |
| 资源 | RES_001 | 资源不存在 |
| 资源 | RES_002 | 资源已存在 |
| 验证 | VAL_001 | 验证失败 |
| 验证 | VAL_002 | 输入无效 |
| 验证 | VAL_003 | 缺少必填字段 |
| 数据库 | DB_001 | 数据库错误 |
| 限流 | RATE_001 | 请求过于频繁 |
| 内部 | INT_001 | 内部错误 |

## 配置选项

```typescript
interface AppConfig {
  // 数据库
  dbUrl?: string;               // 数据库连接URL
  dbType?: 'pg' | 'mysql' | 'sqlite';
  
  // 缓存
  redis?: {
    redis?: string | RedisOptions;
    useMemory?: boolean;
    defaultTTL?: number;
    prefix?: string;
  };
  
  // 认证
  auth?: {
    jwtSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
    cookieSecure?: boolean;
    enableRefreshTokenRotation?: boolean;
  };
  
  // 安全
  enableCors?: boolean;
  corsOrigin?: string | string[];
  enableHelmet?: boolean;
  trustProxy?: boolean | number | string;
  
  // 限流
  enableRateLimit?: boolean;
  rateLimitWindow?: number;
  rateLimitMax?: number;
  
  // 日志
  enableLogging?: boolean;
  logging?: {
    serviceName?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    jsonFormat?: boolean;
    excludePaths?: string[];
  };
  
  // 其他
  skipMigrations?: boolean;
  apiBasePath?: string;
}
```

## 角色权限

| 角色 | 读取 | 创建 | 更新 | 删除 | 发布 | 邀请 | 设置 |
|------|------|------|------|------|------|------|------|
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| creator | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| editor | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| commenter | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## 开发

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 构建
pnpm build

# 类型检查
pnpm exec tsc --noEmit
```

## 更新日志

### v1.0.0 (架构优化)

- **新增**: 标准化 API 响应格式 (`sendSuccess`, `sendList`, `sendCreated`)
- **新增**: 服务层抽象 (`UserService`, `ProjectService`, `PageService`, `FlowService`)
- **新增**: 基础服务类 (`BaseService`) 提供统一 CRUD 操作
- **新增**: 响应工具函数 (`utils/response.ts`)
- **优化**: 控制器重构，统一错误处理和验证
- **优化**: 更清晰的代码分层结构
- **优化**: 完整的 TypeScript 类型支持
- **优化**: API 路由更加 RESTful

## License

MIT
