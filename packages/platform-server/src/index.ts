/**
 * Platform Server
 * Low-code platform backend service based on Express.js and AgentDB
 *
 * @module platform-server
 */

// ============================================================================
// Main Entry Point
// ============================================================================

export { App, type AppConfig } from './lib/App.js';
export { runMigrations, rollbackMigration } from './lib/migrations.js';
export { NcMetaIO, initNcMeta, getNcMeta } from './lib/NcMetaIO.js';

// ============================================================================
// Cache
// ============================================================================

export {
  NocoCache,
  initCache,
  getCache,
  type CacheConfig,
  type ICacheStore,
} from './cache/index.js';

// ============================================================================
// Auth
// ============================================================================

export {
  configureAuth,
  getAuthConfig,
  configurePassport,
  generateToken,
  verifyToken,
  refreshToken,
  requireAuth,
  optionalAuth,
  requireProjectPermission,
  requireRole,
  type AuthConfig,
} from './auth/index.js';

// ============================================================================
// Models
// ============================================================================

export {
  User,
  Project,
  Database,
  AppModel,
  Page,
  FlowApp,
  Flow,
  type BaseModelOptions,
} from './models/index.js';

// ============================================================================
// Types
// ============================================================================

export * from './types/index.js';

// ============================================================================
// Meta APIs
// ============================================================================

export {
  createProjectRouter,
  createTableRouter,
  createAppRouter,
  createPageRouter,
  createFlowAppRouter,
  createAuthRouter,
  createUserRouter,
} from './meta/api/index.js';

// ============================================================================
// Default Export
// ============================================================================

import { App } from './lib/App.js';
export default App;
