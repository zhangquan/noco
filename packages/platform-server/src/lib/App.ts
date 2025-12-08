/**
 * App - Main Application Entry Point (Singleton)
 * @module lib/App
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Knex } from 'knex';

import { DatabaseManager, runMigrations, type DatabaseType } from '../db/index.js';
import { initCache, type CacheConfig } from '../cache/index.js';
import { configurePassport, configureAuth, requireAuth, optionalAuth, type AuthConfig } from '../auth/index.js';
import {
  createProjectRouter,
  createTableRouter,
  createPageRouter,
  createFlowRouter,
  createAuthRouter,
  createUserRouter,
} from '../api/index.js';
import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
  createErrorHandler,
  notFoundHandler,
  createHealthRouter,
  createRateLimitFromPreset,
  initLogger,
  type LoggerConfig,
  type ErrorHandlerOptions,
} from '../middleware/index.js';

// ============================================================================
// AgentDB Dynamic Import
// ============================================================================

let agentDbModule: any = null;

async function getAgentDb(): Promise<any | null> {
  if (agentDbModule !== null) return agentDbModule;
  try {
    // @ts-ignore - Dynamic import of optional dependency
    agentDbModule = await import('@workspace/agentdb');
    return agentDbModule;
  } catch {
    console.warn('⚠️ AgentDB module not available, data API will be disabled');
    agentDbModule = false;
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface AppConfig {
  /** Database connection URL */
  dbUrl?: string;
  /** Database type */
  dbType?: DatabaseType;
  /** Redis/cache configuration */
  redis?: CacheConfig;
  /** Auth configuration */
  auth?: Partial<AuthConfig>;
  /** Enable CORS */
  enableCors?: boolean;
  /** CORS origin */
  corsOrigin?: string | string[];
  /** Enable rate limiting */
  enableRateLimit?: boolean;
  /** Rate limit window in ms */
  rateLimitWindow?: number;
  /** Rate limit max requests */
  rateLimitMax?: number;
  /** Enable logging */
  enableLogging?: boolean;
  /** Enable helmet security headers */
  enableHelmet?: boolean;
  /** Skip running migrations */
  skipMigrations?: boolean;
  /** API base path */
  apiBasePath?: string;
  /** Logger configuration */
  logging?: LoggerConfig;
  /** Error handler options */
  errorHandler?: ErrorHandlerOptions;
  /** Trust proxy setting for rate limiting */
  trustProxy?: boolean | number | string;
}

// ============================================================================
// App Singleton
// ============================================================================

export class App {
  private static instance: App | null = null;
  private app: Application;
  private httpServer: http.Server | null = null;
  private dbManager: DatabaseManager;
  private config: AppConfig;
  private initialized = false;

  private constructor(config: AppConfig = {}) {
    this.config = config;
    this.app = express();
    this.dbManager = DatabaseManager.getInstance();
  }

  static getInstance(config?: AppConfig): App {
    if (!App.instance) {
      App.instance = new App(config);
    }
    return App.instance;
  }

  static async init(config: AppConfig = {}, httpServer?: http.Server, existingApp?: Application): Promise<Application> {
    const app = App.getInstance(config);
    if (existingApp) (app as any).app = existingApp;
    if (httpServer) app.httpServer = httpServer;
    await app.initialize();
    return app.getExpressApp();
  }

  getExpressApp(): Application { return this.app; }
  getHttpServer(): http.Server | null { return this.httpServer; }
  
  getDb(): Knex {
    return this.dbManager.getDb();
  }

  getDbManager(): DatabaseManager {
    return this.dbManager;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Platform Server...');

    await this.initDatabase();
    this.initCache();
    if (!this.config.skipMigrations) await this.runMigrations();
    this.initAuth();
    this.configureMiddleware();
    await this.registerRoutes();
    this.configureErrorHandlers();

    this.initialized = true;
    console.log('✅ Platform Server initialized successfully');
  }

  private async initDatabase(): Promise<void> {
    const dbUrl = this.config.dbUrl || process.env.DATABASE_URL || process.env.META_SERVER_DB;
    const dbType = this.config.dbType || (process.env.DB_TYPE as DatabaseType) || 'pg';

    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable or dbUrl config is required');
    }

    // Use DatabaseManager to handle connection
    await this.dbManager.connect({
      type: dbType,
      connection: dbUrl,
      pool: { min: 2, max: 10 },
    });

    // Initialize AgentDB if available
    const agentDb = await getAgentDb();
    if (agentDb) {
      await agentDb.initDatabase(this.dbManager.getDb());
    }
  }

  private initCache(): void {
    console.log('🗄️ Initializing cache...');
    const cacheConfig: CacheConfig = { useMemory: true, ...this.config.redis };
    const redisUrl = process.env.REDIS_URL || process.env.NC_REDIS_URL;
    if (redisUrl) {
      cacheConfig.useMemory = false;
      cacheConfig.redis = redisUrl;
    }
    initCache(cacheConfig);
    console.log(`✅ Cache initialized (${cacheConfig.useMemory ? 'memory' : 'redis'})`);
  }

  private async runMigrations(): Promise<void> {
    await runMigrations(this.dbManager.getDb());
    console.log('✅ Migrations completed');
  }

  private initAuth(): void {
    console.log('🔐 Initializing authentication...');
    if (this.config.auth) configureAuth(this.config.auth);
    configurePassport(passport);
    this.app.use(passport.initialize());
    console.log('✅ Authentication initialized');
  }

  private configureMiddleware(): void {
    console.log('⚙️ Configuring middleware...');

    // Trust proxy for accurate IP detection
    if (this.config.trustProxy !== undefined) {
      this.app.set('trust proxy', this.config.trustProxy);
    }

    // Request ID and structured logging
    this.app.use(requestIdMiddleware());

    // Initialize logger
    if (this.config.logging) {
      initLogger(this.config.logging);
    }

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());

    // Security headers
    if (this.config.enableHelmet !== false) {
      this.app.use(helmet({ 
        contentSecurityPolicy: false, 
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }));
    }

    // CORS
    if (this.config.enableCors !== false) {
      this.app.use(cors({ 
        origin: this.config.corsOrigin || true, 
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Api-Key'],
        exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      }));
    }

    // Request logging
    if (this.config.enableLogging !== false) {
      this.app.use(requestLoggingMiddleware(this.config.logging));
    }

    // Global rate limiting
    if (this.config.enableRateLimit) {
      this.app.use(createRateLimitFromPreset('api'));
    }

    console.log('✅ Middleware configured');
  }

  private async registerRoutes(): Promise<void> {
    console.log('🛤️ Registering routes...');

    const basePath = this.config.apiBasePath || '/api/v1/db';
    const db = this.dbManager.getDb();

    // Health check routes with comprehensive checks
    const healthRouter = createHealthRouter(
      () => db,
      { version: '0.98.3' }
    );
    this.app.use('/health', healthRouter);

    // Auth routes with strict rate limiting
    const authRateLimiter = createRateLimitFromPreset('auth');
    this.app.use(`${basePath}/auth`, authRateLimiter, createAuthRouter());

    const authMiddleware = requireAuth(passport);
    const optionalAuthMiddleware = optionalAuth(passport);

    // User routes
    this.app.use(`${basePath}/users`, authMiddleware, createUserRouter());

    // Project routes
    this.app.use(`${basePath}/meta/projects`, authMiddleware, createProjectRouter());
    
    // Table routes
    this.app.use(`${basePath}/meta/projects/:projectId/tables`, authMiddleware, createTableRouter());
    
    // Page routes (pages belong to project directly)
    this.app.use(`${basePath}/meta/projects/:projectId/pages`, authMiddleware, createPageRouter());
    
    // Flow routes (flows belong to project directly)
    this.app.use(`${basePath}/meta/projects/:projectId/flows`, authMiddleware, createFlowRouter());

    // Data API routes - only if AgentDB is available
    const agentDb = await getAgentDb();
    if (agentDb) {
      const { createPersistentSchemaManager, createRestApi } = agentDb;
      
      // Cache for SchemaManagers
      const schemaManagerCache = new Map<string, { manager: any; lastAccess: number }>();
      
      // Clean up cache periodically
      setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of schemaManagerCache.entries()) {
          if (now - entry.lastAccess > 5 * 60 * 1000) { // 5 minutes idle
            schemaManagerCache.delete(key);
          }
        }
      }, 60000);

      const dataRateLimiter = createRateLimitFromPreset('data');
      
      this.app.use(`${basePath}/data/:projectId`, optionalAuthMiddleware, dataRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
        try {
          const { projectId } = req.params;
          const cacheKey = `project:${projectId}`;
          
          // Get or create SchemaManager with caching
          let cached = schemaManagerCache.get(cacheKey);
          if (!cached) {
            const manager = createPersistentSchemaManager({ db, namespace: cacheKey });
            try { await manager.load(); } catch { /* No schema yet */ }
            cached = { manager, lastAccess: Date.now() };
            schemaManagerCache.set(cacheKey, cached);
          } else {
            cached.lastAccess = Date.now();
          }

          const tables = cached.manager.getTables();
          const dataRouter = createRestApi({
            db,
            tables,
            basePath: '',
            enablePublicApi: true,
            enableExportApi: true,
          });
          dataRouter(req as any, res as any, next);
        } catch (error) {
          next(error);
        }
      });
    }

    console.log('✅ Routes registered');
  }

  private configureErrorHandlers(): void {
    // Error logging middleware
    if (this.config.enableLogging !== false) {
      this.app.use(errorLoggingMiddleware(this.config.logging));
    }

    // 404 handler
    this.app.use(notFoundHandler());

    // Global error handler
    this.app.use(createErrorHandler({
      includeStack: process.env.NODE_ENV !== 'production',
      logErrors: true,
      ...this.config.errorHandler,
    }));
  }

  async listen(port: number = 8080): Promise<http.Server> {
    if (!this.initialized) await this.initialize();
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(port, () => {
        console.log(`🌐 Server listening on port ${port}`);
        resolve(this.httpServer!);
      });
    });
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down...');
    if (this.httpServer) {
      await new Promise<void>((resolve) => { this.httpServer!.close(() => resolve()); });
    }
    
    // Close database connection
    await this.dbManager.disconnect();
    
    // Close cache
    const { NocoCache } = await import('../cache/index.js');
    await NocoCache.getInstance().close();
    
    App.instance = null;
    console.log('👋 Shutdown complete');
  }
}

export default App;
