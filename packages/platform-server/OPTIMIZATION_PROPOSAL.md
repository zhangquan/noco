# Platform Server 优化方案

> 低代码平台后端服务架构优化提案 (仅方案，不实现)

## 目录

1. [当前架构分析](#一当前架构分析)
2. [优化目标](#二优化目标)
3. [架构层面优化](#三架构层面优化)
4. [代码质量优化](#四代码质量优化)
5. [性能优化](#五性能优化)
6. [可扩展性优化](#六可扩展性优化)
7. [安全性优化](#七安全性优化)
8. [实施计划](#八实施计划)

---

## 一、当前架构分析

### 1.1 现有架构概览

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
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        服务层 (Services)                             │
│  UserService │ ProjectService │ PageService │ FlowService           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────────┐   ┌──────────────────────────────┐
│       PostgreSQL (Knex)           │   │      NocoCache (缓存)        │
│  元数据/业务数据存储               │   │  Redis / In-Memory           │
└───────────────────────────────────┘   └──────────────────────────────┘
```

### 1.2 当前优点

| 特性 | 说明 |
|-----|------|
| ✅ 分层架构 | Controller → Service → Model 清晰分离 |
| ✅ 统一响应格式 | `sendSuccess`, `sendList`, `sendCreated` 等工具函数 |
| ✅ BaseService 抽象 | 提供统一 CRUD 操作和缓存集成 |
| ✅ 错误处理 | 完善的错误类体系和统一格式 |
| ✅ TypeScript | 完整类型支持 |
| ✅ Zod 验证 | 请求参数验证 |
| ✅ AgentDB 集成 | 动态 Schema 和数据 API |

### 1.3 待优化问题

| 问题 | 位置 | 影响 |
|-----|------|------|
| 🔸 Controller 代码重复 | 各 Controller | 可维护性 |
| 🔸 Service 缺少接口定义 | services/*.ts | 可测试性、解耦 |
| 🔸 SchemaManager 缓存策略简单 | TableController | 性能 |
| 🔸 动态导入 AgentDB | App.ts, TableController | 性能、错误处理 |
| 🔸 缺少请求级事务管理 | 全局 | 数据一致性 |
| 🔸 Models 层定位不清 | models/*.ts | 架构清晰度 |
| 🔸 缺少依赖注入 | 全局 | 可测试性、灵活性 |
| 🔸 日志分散 | 各处 console.log | 可观测性 |
| 🔸 缺少健康检查深度 | health.ts | 运维 |
| 🔸 API 版本管理缺失 | App.ts | 兼容性 |

---

## 二、优化目标

### 2.1 核心目标

1. **可维护性** - 减少代码重复，统一模式
2. **可测试性** - 依赖注入，接口抽象
3. **性能** - 优化缓存策略，减少数据库查询
4. **可扩展性** - 插件化架构，模块解耦
5. **可观测性** - 统一日志，链路追踪，指标监控

### 2.2 量化指标

| 指标 | 当前 | 目标 |
|-----|------|------|
| 单元测试覆盖率 | - | > 80% |
| Controller 代码行数 | ~300行/文件 | < 100行/文件 |
| 响应时间 (P99) | - | < 100ms |
| 错误率 | - | < 0.1% |

---

## 三、架构层面优化

### 3.1 引入依赖注入容器

**问题**: 当前 Service 使用单例模式，难以测试和替换。

**方案**: 引入轻量级 DI 容器 (如 `tsyringe` 或自实现)。

```typescript
// 目标结构
@injectable()
class UserService implements IUserService {
  constructor(
    @inject('IDatabase') private db: IDatabase,
    @inject('ICache') private cache: ICache,
    @inject('ILogger') private logger: ILogger,
  ) {}
}

// 使用
const container = new Container();
container.register('IDatabase', DatabaseManager);
container.register('ICache', NocoCache);
container.register('IUserService', UserService);

const userService = container.resolve<IUserService>('IUserService');
```

**收益**:
- 便于单元测试 (Mock 依赖)
- 运行时替换实现
- 清晰的依赖关系

---

### 3.2 Service 接口定义

**问题**: Service 直接暴露类，难以 Mock 和扩展。

**方案**: 为每个 Service 定义接口。

```typescript
// services/interfaces/IUserService.ts
export interface IUserService {
  getById(id: string, options?: ServiceOptions): Promise<User | null>;
  getByIdOrFail(id: string, options?: ServiceOptions): Promise<User>;
  getByEmail(email: string, options?: ServiceOptions): Promise<User | null>;
  signup(input: SignupInput, options?: ServiceOptions): Promise<AuthResult>;
  signin(input: SigninInput, options?: ServiceOptions): Promise<AuthResult>;
  // ...
}

// services/interfaces/index.ts
export type { IUserService } from './IUserService';
export type { IProjectService } from './IProjectService';
export type { IPageService } from './IPageService';
export type { IFlowService } from './IFlowService';
```

---

### 3.3 统一 Controller 基类增强

**问题**: Controller 中存在重复的认证检查、权限验证、参数解析代码。

**方案**: 增强 `BaseController`，提供更多通用功能。

```typescript
// controllers/base/BaseController.ts (增强版)
export abstract class BaseController {
  // 现有方法...

  /**
   * 创建带权限检查的处理器
   */
  protected withPermission<TBody, TParams, TQuery>(
    projectIdExtractor: (params: TParams) => string,
    permission: string,
    handler: ControllerHandler<TBody, TParams, TQuery>
  ): RequestHandler {
    return this.handle(async (ctx) => {
      const projectId = projectIdExtractor(ctx.params);
      await ProjectService.requirePermission(projectId, ctx.userId!, permission);
      return handler(ctx);
    });
  }

  /**
   * 创建带事务的处理器
   */
  protected withTransaction<TBody, TParams, TQuery, TResult>(
    handler: (ctx: HandlerContext<TBody, TParams, TQuery>, trx: Knex.Transaction) => Promise<TResult>
  ): RequestHandler {
    return this.handle(async (ctx) => {
      const db = getDb();
      return db.transaction(async (trx) => {
        return handler(ctx, trx);
      });
    });
  }

  /**
   * 标准 CRUD 操作工厂
   */
  protected createCrudHandlers<TEntity extends BaseEntity>(
    service: BaseService<TEntity>,
    options: CrudOptions = {}
  ): CrudHandlers {
    return {
      list: this.handle(async (ctx) => {
        const pagination = this.getPagination(ctx.query);
        const result = await service.list(pagination.page, pagination.pageSize);
        return this.list(ctx.res, result.data, result);
      }),
      get: this.handle(async (ctx) => {
        const entity = await service.getByIdOrFail(ctx.params.id);
        return this.ok(ctx.res, entity);
      }),
      create: this.handle(async (ctx) => {
        const entity = await service.create(ctx.body);
        return this.created(ctx.res, entity);
      }),
      update: this.handle(async (ctx) => {
        const entity = await service.update(ctx.params.id, ctx.body);
        return this.ok(ctx.res, entity);
      }),
      delete: this.handle(async (ctx) => {
        await service.delete(ctx.params.id);
        return this.noContent(ctx.res);
      }),
    };
  }
}
```

---

### 3.4 Models 层重新定位

**问题**: `models/` 目录下混杂了实体定义、数据访问、工具函数。

**方案**: 重新定义 Models 层职责，与 Service 层明确分工。

```
# 当前结构
models/
├── Flow.ts         # 混合：类型定义 + 数据访问
├── Page.ts         # 混合：类型定义 + 数据访问
├── Project.ts      # 混合：类型定义 + 数据访问
├── Schema.ts       # Schema 数据访问
├── Table.ts        # 通用表操作
├── User.ts         # 混合：类型定义 + 数据访问
└── index.ts

# 优化后结构
models/                       # 仅保留实体定义和简单查询
├── entities/                 # 实体定义 (与 types/ 合并或保留)
│   ├── User.ts
│   ├── Project.ts
│   ├── Page.ts
│   └── Flow.ts
├── repositories/             # 数据访问层 (可选，复杂查询)
│   ├── UserRepository.ts
│   ├── ProjectRepository.ts
│   └── ...
└── index.ts

services/                     # 业务逻辑层 (保持不变，调用 repositories)
├── UserService.ts
├── ProjectService.ts
└── ...
```

**或简化方案**: 直接删除 `models/` 中的数据访问代码，全部由 `BaseService` 处理。

---

### 3.5 SchemaManager 缓存优化

**问题**: `TableController` 中每次请求都可能创建新的 `SchemaManager`。

**方案**: 引入 LRU 缓存和预加载机制。

```typescript
// services/SchemaManagerCache.ts
import LRUCache from 'lru-cache';

interface CachedManager {
  manager: SchemaManager;
  loadedAt: number;
}

class SchemaManagerCache {
  private cache: LRUCache<string, CachedManager>;
  private ttl: number;
  
  constructor(options: { max?: number; ttl?: number } = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes
    this.cache = new LRUCache({
      max: options.max || 100,
      ttl: this.ttl,
      dispose: (key, value) => {
        // 可选：释放资源
      },
    });
  }

  async get(projectId: string, db: Knex): Promise<SchemaManager> {
    const cacheKey = `project:${projectId}`;
    let cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached.manager;
    }

    const manager = createPersistentSchemaManager({
      db,
      namespace: cacheKey,
      autoSave: true,
    });

    try {
      await manager.load();
    } catch {
      // No existing schema
    }

    this.cache.set(cacheKey, {
      manager,
      loadedAt: Date.now(),
    });

    return manager;
  }

  invalidate(projectId: string): void {
    this.cache.delete(`project:${projectId}`);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

// 导出单例
export const schemaManagerCache = new SchemaManagerCache();
```

---

### 3.6 请求级上下文管理

**问题**: 缺少请求级别的上下文传递机制。

**方案**: 使用 `AsyncLocalStorage` 实现请求上下文。

```typescript
// context/RequestContext.ts
import { AsyncLocalStorage } from 'async_hooks';
import type { Knex } from 'knex';

export interface RequestContextData {
  requestId: string;
  userId?: string;
  projectId?: string;
  trx?: Knex.Transaction;
  startTime: number;
  metadata: Record<string, unknown>;
}

class RequestContext {
  private storage = new AsyncLocalStorage<RequestContextData>();

  run<T>(context: RequestContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): RequestContextData | undefined {
    return this.storage.getStore();
  }

  getOrFail(): RequestContextData {
    const ctx = this.get();
    if (!ctx) throw new Error('No request context available');
    return ctx;
  }

  // 便捷方法
  getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  getUserId(): string | undefined {
    return this.get()?.userId;
  }

  getTransaction(): Knex.Transaction | undefined {
    return this.get()?.trx;
  }
}

export const requestContext = new RequestContext();

// 中间件
export function requestContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const context: RequestContextData = {
      requestId: req.headers['x-request-id'] as string || generateId(),
      userId: (req as ApiRequest).user?.id,
      startTime: Date.now(),
      metadata: {},
    };

    requestContext.run(context, () => {
      next();
    });
  };
}
```

---

## 四、代码质量优化

### 4.1 Controller 代码简化

**问题**: 每个 Controller 有大量重复的 try-catch、验证、响应代码。

**当前代码示例 (ProjectController)**:
```typescript
async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    
    const result = await ProjectService.listForUserPaginated(
      userId,
      pagination.page,
      pagination.pageSize
    );

    sendList(res, result.data, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (error) {
    next(error);
  }
}
```

**优化后代码**:
```typescript
// 使用 BaseController.handle() 自动处理 try-catch
const list = controller.handle(async ({ req, res, userId }) => {
  const pagination = parsePagination(req.query);
  const result = await ProjectService.listForUserPaginated(userId!, pagination.page, pagination.pageSize);
  return controller.list(res, result.data, result);
});
```

### 4.2 统一验证模式

**问题**: 验证 Schema 分散在各 Controller 中。

**方案**: 集中管理验证 Schema。

```typescript
// validation/schemas/index.ts
export * from './auth.schemas';
export * from './project.schemas';
export * from './page.schemas';
export * from './flow.schemas';
export * from './table.schemas';

// validation/schemas/project.schemas.ts
export const ProjectSchemas = {
  create: z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    prefix: z.string().max(20).optional(),
  }),
  update: z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    color: z.string().optional(),
  }),
  params: z.object({
    projectId: z.string().ulid(),
  }),
};
```

### 4.3 日志系统统一

**问题**: 分散的 `console.log` 和 `console.warn` 调用。

**方案**: 使用结构化日志。

```typescript
// utils/logger.ts
import pino from 'pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

class StructuredLogger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  private enrichContext(ctx?: LogContext): LogContext {
    const requestCtx = requestContext.get();
    return {
      requestId: requestCtx?.requestId,
      userId: requestCtx?.userId,
      ...ctx,
    };
  }

  info(message: string, ctx?: LogContext): void {
    this.logger.info(this.enrichContext(ctx), message);
  }

  warn(message: string, ctx?: LogContext): void {
    this.logger.warn(this.enrichContext(ctx), message);
  }

  error(message: string, error?: Error, ctx?: LogContext): void {
    this.logger.error({
      ...this.enrichContext(ctx),
      err: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    }, message);
  }

  debug(message: string, ctx?: LogContext): void {
    this.logger.debug(this.enrichContext(ctx), message);
  }
}

export const logger = new StructuredLogger();
```

---

## 五、性能优化

### 5.1 数据库查询优化

#### 5.1.1 N+1 查询问题

**问题**: 列表查询后逐个获取关联数据。

**方案**: 使用 DataLoader 批量加载。

```typescript
// loaders/ProjectLoader.ts
import DataLoader from 'dataloader';

export function createProjectLoader(db: Knex) {
  return new DataLoader<string, Project | null>(async (ids) => {
    const projects = await db('nc_projects')
      .whereIn('id', ids as string[])
      .select('*');
    
    const projectMap = new Map(projects.map(p => [p.id, p]));
    return ids.map(id => projectMap.get(id) || null);
  });
}

// 使用
const projectLoader = createProjectLoader(db);
const projects = await Promise.all(projectIds.map(id => projectLoader.load(id)));
```

#### 5.1.2 查询结果缓存

**方案**: 多级缓存策略。

```typescript
// cache/strategies.ts
export interface CacheStrategy {
  // 本地内存缓存 (进程级)
  local: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  // Redis 缓存 (分布式)
  distributed: {
    enabled: boolean;
    ttl: number;
  };
}

export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // 用户信息 - 频繁访问，变化少
  user: {
    local: { enabled: true, ttl: 60, maxSize: 1000 },
    distributed: { enabled: true, ttl: 300 },
  },
  // 项目信息 - 中等访问频率
  project: {
    local: { enabled: true, ttl: 30, maxSize: 500 },
    distributed: { enabled: true, ttl: 120 },
  },
  // Schema 信息 - 访问频繁，变化较少
  schema: {
    local: { enabled: true, ttl: 120, maxSize: 200 },
    distributed: { enabled: true, ttl: 600 },
  },
};
```

### 5.2 连接池优化

```typescript
// db/config.ts
export const POOL_CONFIG = {
  // 开发环境
  development: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  },
  // 生产环境
  production: {
    min: 5,
    max: 50,
    acquireTimeoutMillis: 60000,
    idleTimeoutMillis: 30000,
  },
};

// 连接池监控
export function setupPoolMonitoring(db: Knex) {
  setInterval(() => {
    const pool = (db.client as any).pool;
    logger.info('Database pool stats', {
      numUsed: pool.numUsed(),
      numFree: pool.numFree(),
      numPendingAcquires: pool.numPendingAcquires(),
      numPendingCreates: pool.numPendingCreates(),
    });
  }, 60000);
}
```

### 5.3 响应压缩

```typescript
// middleware/compression.ts
import compression from 'compression';

export function createCompressionMiddleware() {
  return compression({
    filter: (req, res) => {
      // 不压缩 Server-Sent Events
      if (req.headers['accept'] === 'text/event-stream') {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // 平衡压缩率和 CPU 消耗
    threshold: 1024, // 仅压缩大于 1KB 的响应
  });
}
```

---

## 六、可扩展性优化

### 6.1 插件化架构

**方案**: 引入插件系统，支持功能扩展。

```typescript
// plugins/types.ts
export interface Plugin {
  name: string;
  version: string;
  
  // 生命周期钩子
  onInit?(app: Application, config: AppConfig): Promise<void>;
  onReady?(app: Application): Promise<void>;
  onShutdown?(): Promise<void>;
  
  // 路由扩展
  registerRoutes?(router: Router): void;
  
  // 中间件扩展
  registerMiddleware?(app: Application): void;
  
  // Service 扩展
  registerServices?(container: Container): void;
}

// plugins/PluginManager.ts
class PluginManager {
  private plugins: Plugin[] = [];

  register(plugin: Plugin): void {
    this.plugins.push(plugin);
    logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  async initAll(app: Application, config: AppConfig): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onInit) {
        await plugin.onInit(app, config);
      }
    }
  }

  // ...其他生命周期方法
}

export const pluginManager = new PluginManager();
```

**示例插件**:
```typescript
// plugins/audit/index.ts
export const auditPlugin: Plugin = {
  name: 'audit',
  version: '1.0.0',

  async onInit(app, config) {
    // 初始化审计表
  },

  registerMiddleware(app) {
    app.use(auditMiddleware());
  },

  registerRoutes(router) {
    router.get('/audit/logs', auditController.list);
    router.get('/audit/logs/:id', auditController.get);
  },
};
```

### 6.2 API 版本管理

```typescript
// lib/App.ts
private async registerRoutes(): Promise<void> {
  const basePath = this.config.apiBasePath || '/api';

  // API v1 (当前版本)
  const v1Router = Router();
  this.configureV1Routes(v1Router);
  this.app.use(`${basePath}/v1`, v1Router);

  // API v2 (未来版本，可选)
  if (this.config.enableV2Api) {
    const v2Router = Router();
    this.configureV2Routes(v2Router);
    this.app.use(`${basePath}/v2`, v2Router);
  }

  // 版本协商 (Accept 头部)
  this.app.use(`${basePath}`, (req, res, next) => {
    const acceptVersion = req.headers['accept-version'];
    if (acceptVersion === '2' && this.config.enableV2Api) {
      req.url = `/v2${req.url}`;
    } else {
      req.url = `/v1${req.url}`;
    }
    next('route');
  });
}
```

### 6.3 多租户支持优化

```typescript
// middleware/tenant.ts
export interface TenantContext {
  tenantId: string;
  dbSchema?: string;
  config?: TenantConfig;
}

export function tenantMiddleware() {
  return async (req: ApiRequest, res: Response, next: NextFunction) => {
    // 从请求中提取租户信息
    const tenantId = extractTenantId(req);
    
    if (!tenantId) {
      return next(); // 单租户模式
    }

    // 加载租户配置
    const tenantConfig = await getTenantConfig(tenantId);
    
    // 设置数据库 schema (PostgreSQL)
    if (tenantConfig.dbSchema) {
      const db = getDb();
      await db.raw(`SET search_path TO ${tenantConfig.dbSchema}, public`);
    }

    req.tenant = {
      tenantId,
      dbSchema: tenantConfig.dbSchema,
      config: tenantConfig,
    };

    next();
  };
}

function extractTenantId(req: ApiRequest): string | null {
  // 方式1: 子域名
  const host = req.hostname;
  const subdomain = host.split('.')[0];
  if (subdomain !== 'api' && subdomain !== 'www') {
    return subdomain;
  }

  // 方式2: 请求头
  const headerTenant = req.headers['x-tenant-id'] as string;
  if (headerTenant) {
    return headerTenant;
  }

  // 方式3: URL 路径
  const pathMatch = req.path.match(/^\/tenants\/([^/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  return null;
}
```

---

## 七、安全性优化

### 7.1 输入验证增强

```typescript
// validation/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput<T extends object>(data: T): T {
  const sanitized = {} as T;
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // 清理 HTML/XSS
      sanitized[key as keyof T] = DOMPurify.sanitize(value) as T[keyof T];
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }
  
  return sanitized;
}

// 中间件
export function sanitizeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    next();
  };
}
```

### 7.2 Rate Limiting 增强

```typescript
// middleware/rateLimit.ts
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';

export interface RateLimitConfig {
  // 基于 IP
  ip: { points: number; duration: number };
  // 基于用户
  user: { points: number; duration: number };
  // 基于 API Key
  apiKey: { points: number; duration: number };
  // 高敏感操作
  sensitive: { points: number; duration: number };
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  default: {
    ip: { points: 100, duration: 60 },
    user: { points: 200, duration: 60 },
    apiKey: { points: 500, duration: 60 },
    sensitive: { points: 5, duration: 300 },
  },
  strict: {
    ip: { points: 30, duration: 60 },
    user: { points: 50, duration: 60 },
    apiKey: { points: 100, duration: 60 },
    sensitive: { points: 3, duration: 600 },
  },
};

export function createAdaptiveRateLimiter(config: RateLimitConfig) {
  return async (req: ApiRequest, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const limiter = getLimiterForRequest(req, config);

    try {
      const result = await limiter.consume(key);
      
      // 设置速率限制响应头
      res.set({
        'X-RateLimit-Limit': limiter.points.toString(),
        'X-RateLimit-Remaining': result.remainingPoints.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
      });

      next();
    } catch (error) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_001',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil(error.msBeforeNext / 1000),
        },
      });
    }
  };
}
```

### 7.3 审计日志

```typescript
// services/AuditService.ts
export interface AuditLog {
  id: string;
  action: AuditAction;
  userId?: string;
  targetType: string;
  targetId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export type AuditAction = 
  | 'create' | 'read' | 'update' | 'delete'
  | 'login' | 'logout' | 'password_change'
  | 'permission_grant' | 'permission_revoke';

class AuditService {
  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const db = getDb();
    const ctx = requestContext.get();

    await db('nc_audit').insert({
      id: generateId(),
      ...entry,
      userId: entry.userId || ctx?.userId,
      ip: entry.ip || ctx?.metadata?.ip,
      userAgent: entry.userAgent || ctx?.metadata?.userAgent,
      timestamp: new Date(),
    });
  }

  async logChange<T extends object>(
    action: 'create' | 'update' | 'delete',
    targetType: string,
    targetId: string,
    oldData?: T,
    newData?: T
  ): Promise<void> {
    const changes = this.diffObjects(oldData, newData);
    await this.log({ action, targetType, targetId, changes });
  }

  private diffObjects<T extends object>(
    old?: T,
    new_?: T
  ): Record<string, { old: unknown; new: unknown }> | undefined {
    if (!old && !new_) return undefined;
    if (!old) return { _created: { old: null, new: new_ } };
    if (!new_) return { _deleted: { old: old, new: null } };

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);

    for (const key of allKeys) {
      const oldVal = (old as any)[key];
      const newVal = (new_ as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }
}

export const auditService = new AuditService();
```

---

## 八、实施计划

### Phase 1: 基础设施优化 (优先级: 高)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| 引入请求上下文 (AsyncLocalStorage) | 2天 | 全局 |
| 统一日志系统 (pino) | 1天 | 全局 |
| SchemaManager 缓存优化 | 2天 | TableController |
| 连接池监控 | 0.5天 | DatabaseManager |

### Phase 2: 架构优化 (优先级: 高)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| Service 接口定义 | 2天 | services/* |
| BaseController 增强 | 2天 | controllers/* |
| 依赖注入容器 (可选) | 3天 | 全局 |
| Models 层重构 | 2天 | models/* |

### Phase 3: 代码质量 (优先级: 中)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| Controller 代码简化 | 3天 | controllers/* |
| 验证 Schema 集中管理 | 1天 | validation/* |
| 单元测试补充 | 5天 | tests/* |
| API 文档生成 | 2天 | docs/* |

### Phase 4: 性能优化 (优先级: 中)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| DataLoader 引入 | 2天 | services/* |
| 多级缓存策略 | 2天 | cache/* |
| 响应压缩 | 0.5天 | middleware/* |
| 查询优化 | 3天 | services/* |

### Phase 5: 安全性增强 (优先级: 中)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| 输入验证增强 | 1天 | middleware/* |
| Rate Limiting 优化 | 1天 | middleware/* |
| 审计日志系统 | 3天 | services/AuditService |

### Phase 6: 可扩展性 (优先级: 低)

| 任务 | 工作量 | 影响范围 |
|-----|--------|---------|
| 插件系统 | 5天 | plugins/* |
| API 版本管理 | 2天 | lib/App.ts |
| 多租户优化 | 3天 | middleware/* |

---

## 总结

### 优化优先级排序

1. **高优先级** (立即实施)
   - 请求上下文管理
   - SchemaManager 缓存优化
   - 统一日志系统
   - Service 接口定义

2. **中优先级** (短期计划)
   - BaseController 增强
   - Controller 代码简化
   - 性能优化
   - 安全性增强

3. **低优先级** (长期规划)
   - 依赖注入容器
   - 插件系统
   - API 版本管理

### 预期收益

| 维度 | 预期提升 |
|-----|---------|
| 代码可维护性 | +50% |
| 测试覆盖率 | +80% |
| 开发效率 | +30% |
| 响应时间 | -30% |
| 错误率 | -50% |

---

## 附录

### A. 依赖包建议

| 包名 | 用途 | 当前状态 |
|-----|------|---------|
| `pino` | 结构化日志 | 建议添加 |
| `dataloader` | 批量数据加载 | 建议添加 |
| `lru-cache` | LRU 缓存 | 建议添加 |
| `compression` | 响应压缩 | 建议添加 |
| `rate-limiter-flexible` | 速率限制 | 可替换现有方案 |
| `isomorphic-dompurify` | XSS 防护 | 建议添加 |
| `tsyringe` | 依赖注入 | 可选 |

### B. 配置示例

```typescript
// config/production.ts
export const productionConfig: AppConfig = {
  dbUrl: process.env.DATABASE_URL,
  dbType: 'pg',
  redis: {
    redis: process.env.REDIS_URL,
    defaultTTL: 3600,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: '1h',
    jwtRefreshExpiresIn: '7d',
  },
  enableLogging: true,
  enableRateLimit: true,
  trustProxy: true,
  logging: {
    level: 'info',
    format: 'json',
  },
  cache: {
    strategy: 'multi-level',
    local: { ttl: 60, maxSize: 1000 },
    distributed: { ttl: 300 },
  },
  performance: {
    compression: true,
    poolSize: { min: 5, max: 50 },
  },
};
```

---

*文档版本: 1.0.0*  
*最后更新: 2024-12-08*
