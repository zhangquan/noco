#!/usr/bin/env node
/**
 * Platform Server Startup Script
 * 
 * Usage:
 *   npx tsx src/start.ts
 * 
 * Environment Variables:
 *   META_SERVER_DB - PostgreSQL connection string for metadata
 *   DATA_SERVER_DB - PostgreSQL connection string for data (defaults to META_SERVER_DB)
 *   REDIS_URL - Redis connection string (optional, defaults to in-memory cache)
 *   NC_AUTH_JWT_SECRET - JWT secret key
 *   PORT - Server port (default: 8080)
 */

import dotenv from 'dotenv';
import App from './lib/App.js';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);

const config = {
  metaDbUrl: process.env.META_SERVER_DB,
  dataDbUrl: process.env.DATA_SERVER_DB,
  dbType: (process.env.DB_TYPE || 'pg') as 'pg' | 'mysql' | 'sqlite',
  enableCors: true,
  enableRateLimit: process.env.NODE_ENV === 'production',
  enableLogging: true,
  enableHelmet: true,
  auth: {
    jwtSecret: process.env.NC_AUTH_JWT_SECRET || 'change-this-in-production',
  },
};

// ============================================================================
// Startup
// ============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       Platform Server v0.98.3          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  try {
    const app = App.getInstance(config);
    await app.listen(PORT);

    console.log('');
    console.log('📋 API Endpoints:');
    console.log(`   Auth:     POST /api/v1/db/auth/signup, /signin`);
    console.log(`   Projects: GET/POST /api/v1/db/meta/projects`);
    console.log(`   Tables:   GET/POST /api/v1/db/meta/projects/:id/tables`);
    console.log(`   Apps:     GET/POST /api/v1/db/meta/projects/:id/apps`);
    console.log(`   Data:     GET/POST /api/v1/db/data/:projectId/:tableName`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
  
  try {
    const app = App.getInstance();
    await app.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
main();
