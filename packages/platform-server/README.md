# Platform Server

> 低代码平台后端服务，基于 Express.js + AgentDB

版本: 0.98.4

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
META_SERVER_DB=postgres://user:pass@localhost:5432/platform_meta
NC_AUTH_JWT_SECRET=your-secret-key

# 可选
DATA_SERVER_DB=postgres://user:pass@localhost:5432/platform_data
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
  metaDbUrl: 'postgres://localhost:5432/platform',
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

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端 (Web/Mobile/API)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        中间件层 (Middleware)                         │
│  • Request ID 生成  • 结构化日志  • CORS  • Helmet  • Rate Limit    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      App.ts (应用入口 - 单例)                        │
│  • 数据库迁移  • JWT 认证  • API 路由注册  • 错误处理                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│    Meta API 层         │ │   Data API 层   │ │   Auth API 层       │
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

## 新特性 (v0.98.4)

### 1. 集中式错误处理

```typescript
import { Errors, ApiError, ValidationError } from '@workspace/platform-server';

// 使用预定义错误
throw Errors.notFound('Project', projectId);
throw Errors.permissionDenied('delete this resource');
throw Errors.missingField('title');

// 自定义错误
throw new ValidationError('Invalid input', [
  { field: 'email', message: 'Invalid email format', code: 'invalid_format' }
]);
```

### 2. 请求验证 (Zod)

```typescript
import { validate, validateBody, z } from '@workspace/platform-server';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

router.post('/users', validateBody(CreateUserSchema), async (req, res) => {
  const { email, password, name } = req.validatedBody;
  // 验证已通过
});
```

### 3. 结构化日志 & 请求追踪

```typescript
import { initLogger, getLogger, requestLoggingMiddleware } from '@workspace/platform-server';

// 初始化日志
initLogger({
  serviceName: 'platform-server',
  logLevel: 'info',
  jsonFormat: process.env.NODE_ENV === 'production',
});

// 使用日志
const logger = getLogger();
logger.info('User created', { userId: user.id, email: user.email });
logger.error('Failed to create user', error, { email });

// 中间件自动添加请求ID
app.use(requestIdMiddleware());
app.use(requestLoggingMiddleware());
```

### 4. 健康检查

```typescript
import { createHealthRouter, performHealthCheck } from '@workspace/platform-server';

// 添加健康检查路由
app.use('/health', createHealthRouter(() => db, { version: '0.98.4' }));

// 手动检查
const health = await performHealthCheck(db);
// {
//   status: 'healthy',
//   components: [
//     { name: 'database', status: 'healthy', latencyMs: 5 },
//     { name: 'cache', status: 'healthy', latencyMs: 2 },
//     { name: 'memory', status: 'healthy', heapPercentage: 45 }
//   ]
// }
```

端点:
- `GET /health` - 完整健康检查
- `GET /health/live` - 存活探针
- `GET /health/ready` - 就绪探针
- `GET /health/detailed` - 详细检查 (含进程信息)

### 5. 灵活的限流

```typescript
import { 
  createRateLimit, 
  createRateLimitFromPreset,
  RateLimitPresets 
} from '@workspace/platform-server';

// 使用预设
app.use('/api/auth', createRateLimitFromPreset('auth')); // 15分钟10次
app.use('/api/data', createRateLimitFromPreset('data')); // 1分钟200次

// 自定义配置
app.use(createRateLimit({
  windowMs: 60 * 1000,
  max: 50,
  useUserId: true, // 按用户限流
  message: 'Too many requests',
}));

// 预设列表
// - auth: 15分钟10次 (登录/注册)
// - passwordReset: 1小时3次
// - api: 1分钟100次
// - apiStrict: 1分钟20次
// - data: 1分钟200次
// - export: 1小时10次
// - bulk: 1分钟5次
// - public: 1分钟30次
```

### 6. 分页支持

```typescript
import { paginatedQuery, parsePaginationOptions } from '@workspace/platform-server';

// 基本分页
const result = await paginatedQuery({
  db,
  table: 'projects',
  condition: { deleted: false },
  pagination: { page: 1, limit: 25 },
  sort: { sortBy: 'created_at', sortOrder: 'desc' },
});

// 结果
{
  list: [...],
  pageInfo: {
    page: 1,
    limit: 25,
    offset: 0,
    totalCount: 100,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: false
  }
}

// 游标分页
const cursorResult = await cursorPaginatedQuery(db, 'projects', {
  cursor: 'base64encodedid',
  limit: 25,
  direction: 'forward'
});
```

### 7. 增强的认证

```typescript
import { 
  generateTokenPair, 
  refreshTokenPair,
  setAuthCookies,
  blacklistToken
} from '@workspace/platform-server';

// 生成令牌对
const tokens = generateTokenPair({ id: user.id, email: user.email });
// { accessToken: '...', refreshToken: '...', expiresIn: 3600 }

// 刷新令牌
const newTokens = await refreshTokenPair(oldRefreshToken);

// 设置安全Cookie
setAuthCookies(res, tokens);

// 注销时使令牌失效
blacklistToken(oldToken);
```

### 8. 审计日志

```typescript
import { logAuditEvent } from '@workspace/platform-server';

logAuditEvent({
  action: 'project.create',
  resourceType: 'project',
  resourceId: project.id,
  userId: user.id,
  projectId: project.id,
  changes: {
    title: { before: null, after: 'New Project' }
  },
  metadata: { source: 'api' }
});
```

### 9. 缓存优化

```typescript
import { 
  cacheAside, 
  cacheAsideList,
  invalidateRelated,
  warmCache 
} from '@workspace/platform-server';

// Cache-aside 模式
const project = await cacheAside(
  `project:${id}`,
  () => Project.findById(id),
  { ttl: 3600 }
);

// 批量失效
await invalidateRelated([
  { scope: CacheScope.PROJECT, id: projectId },
  { scope: CacheScope.PROJECT, listKey: 'all' },
  { scope: CacheScope.APP, listKey: projectId },
]);

// 缓存预热
await warmCache({
  scope: CacheScope.PROJECT,
  fetchAll: () => Project.list(),
  ttl: 3600,
  batchSize: 100,
});
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
| Project | `GET/POST /api/v1/db/meta/projects` | 项目列表/创建 |
| Project | `GET/PATCH/DELETE /api/v1/db/meta/projects/:id` | 项目详情/更新/删除 |
| Project | `GET/POST /api/v1/db/meta/projects/:id/users` | 项目成员 |
| Table | `GET/POST /api/v1/db/meta/projects/:id/tables` | 表列表/创建 |
| Table | `POST /api/v1/db/meta/projects/:id/tables/:id/columns` | 添加列 |
| Table | `POST /api/v1/db/meta/projects/:id/tables/links` | 创建关联 |
| Table | `GET /api/v1/db/meta/projects/:id/tables/schema/export` | 导出Schema |
| App | `GET/POST /api/v1/db/meta/projects/:id/apps` | 应用列表/创建 |
| App | `POST /api/v1/db/meta/projects/:id/apps/:id/publish` | 发布应用 |
| Page | `GET/POST /api/v1/db/meta/apps/:id/pages` | 页面列表/创建 |
| Flow | `GET/POST /api/v1/db/meta/projects/:id/flows` | 工作流列表/创建 |
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
  metaDbUrl?: string;           // 元数据数据库连接
  dataDbUrl?: string;           // 数据数据库连接
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
pnpm tsc --noEmit
```

## License

MIT
