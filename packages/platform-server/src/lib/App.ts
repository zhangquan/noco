/**
 * App - Main Application Entry Point (Singleton)
 * @module lib/App
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import type { Knex } from 'knex';
import knex from 'knex';

import { initDatabase, createRestApi, createPersistentSchemaManager } from '@workspace/agentdb';
import { initNcMeta } from './NcMetaIO.js';
import { initCache, type CacheConfig } from '../cache/index.js';
import { configurePassport, configureAuth, requireAuth, optionalAuth, type AuthConfig } from '../auth/index.js';
import {
  createProjectRouter,
  createTableRouter,
  createAppRouter,
  createPageRouter,
  createFlowAppRouter,
  createAuthRouter,
  createUserRouter,
} from '../meta/api/index.js';
import { runMigrations } from './migrations.js';

// ============================================================================
// Types
// ============================================================================

export interface AppConfig {
  metaDbUrl?: string;
  dataDbUrl?: string;
  dbType?: 'pg' | 'mysql' | 'sqlite';
  redis?: CacheConfig;
  auth?: Partial<AuthConfig>;
  enableCors?: boolean;
  corsOrigin?: string | string[];
  enableRateLimit?: boolean;
  rateLimitWindow?: number;
  rateLimitMax?: number;
  enableLogging?: boolean;
  enableHelmet?: boolean;
  skipMigrations?: boolean;
  apiBasePath?: string;
}

// ============================================================================
// App Singleton
// ============================================================================

export class App {
  private static instance: App | null = null;
  private app: Application;
  private httpServer: http.Server | null = null;
  private metaDb: Knex | null = null;
  private dataDb: Knex | null = null;
  private config: AppConfig;
  private initialized = false;

  private constructor(config: AppConfig = {}) {
    this.config = config;
    this.app = express();
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
  getMetaDb(): Knex {
    if (!this.metaDb) throw new Error('Meta database not initialized');
    return this.metaDb;
  }
  getDataDb(): Knex {
    if (!this.dataDb) throw new Error('Data database not initialized');
    return this.dataDb;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🚀 Initializing Platform Server...');

    await this.initDatabases();
    this.initCache();
    if (!this.config.skipMigrations) await this.runMigrations();
    this.initAuth();
    this.configureMiddleware();
    this.registerRoutes();
    this.configureErrorHandlers();

    this.initialized = true;
    console.log('✅ Platform Server initialized successfully');
  }

  private async initDatabases(): Promise<void> {
    const metaDbUrl = this.config.metaDbUrl || process.env.META_SERVER_DB;
    const dataDbUrl = this.config.dataDbUrl || process.env.DATA_SERVER_DB || metaDbUrl;
    const dbType = this.config.dbType || (process.env.DB_TYPE as 'pg' | 'mysql' | 'sqlite') || 'pg';

    if (!metaDbUrl) {
      throw new Error('META_SERVER_DB environment variable or metaDbUrl config is required');
    }

    console.log('📦 Connecting to databases...');

    this.metaDb = knex({ client: dbType === 'pg' ? 'pg' : dbType, connection: metaDbUrl, pool: { min: 2, max: 10 } });
    this.dataDb = (dataDbUrl && dataDbUrl !== metaDbUrl)
      ? knex({ client: dbType === 'pg' ? 'pg' : dbType, connection: dataDbUrl, pool: { min: 2, max: 10 } })
      : this.metaDb;

    initNcMeta(this.metaDb, dbType);
    await initDatabase(this.dataDb);

    console.log('✅ Database connections established');
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
    console.log('📋 Running migrations...');
    await runMigrations(this.metaDb!);
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

    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());

    if (this.config.enableHelmet !== false) {
      this.app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
    }

    if (this.config.enableCors !== false) {
      this.app.use(cors({ origin: this.config.corsOrigin || true, credentials: true }));
    }

    if (this.config.enableLogging !== false) {
      this.app.use(morgan('combined'));
    }

    console.log('✅ Middleware configured');
  }

  private registerRoutes(): void {
    console.log('🛤️ Registering routes...');

    const basePath = this.config.apiBasePath || '/api/v1/db';

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.use(`${basePath}/auth`, createAuthRouter());

    const authMiddleware = requireAuth(passport);
    const optionalAuthMiddleware = optionalAuth(passport);

    this.app.use(`${basePath}/users`, authMiddleware, createUserRouter());
    this.app.use(`${basePath}/meta/projects`, authMiddleware, createProjectRouter());
    this.app.use(`${basePath}/meta/projects/:projectId/tables`, authMiddleware, createTableRouter());
    this.app.use(`${basePath}/meta/projects/:projectId/apps`, authMiddleware, createAppRouter());
    this.app.use(`${basePath}/meta/apps/:appId/pages`, authMiddleware, createPageRouter());
    this.app.use(`${basePath}/meta/projects/:projectId/flows`, authMiddleware, createFlowAppRouter());

    // Data API routes
    const dataDb = this.dataDb!;
    this.app.use(`${basePath}/data/:projectId`, optionalAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { projectId } = req.params;
        const schemaManager = createPersistentSchemaManager({ db: dataDb, namespace: `project:${projectId}` });
        try { await schemaManager.load(); } catch { /* No schema yet */ }

        const tables = schemaManager.getTables();
        const dataRouter = createRestApi({
          db: dataDb,
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

    console.log('✅ Routes registered');
  }

  private configureErrorHandlers(): void {
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} not found` });
    });

    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const statusCode = (err as any).statusCode || 500;
      const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
      res.status(statusCode).json({
        error: err.name || 'Error',
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
      });
    });
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
    if (this.metaDb) await this.metaDb.destroy();
    if (this.dataDb && this.dataDb !== this.metaDb) await this.dataDb.destroy();
    const { NocoCache } = await import('../cache/index.js');
    await NocoCache.getInstance().close();
    App.instance = null;
    console.log('👋 Shutdown complete');
  }
}

export default App;
