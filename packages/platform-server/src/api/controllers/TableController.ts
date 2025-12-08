/**
 * Table Controller
 * Handles table/model schema management endpoints
 * Uses agentdb SchemaManager for table/column management
 * @module api/controllers/TableController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ProjectService } from '../../services/ProjectService.js';
import { sendSuccess, sendCreated, sendList } from '../../utils/response.js';
import { ValidationError, AuthenticationError, NotFoundError } from '../../errors/index.js';
import { getDb } from '../../db/index.js';
import type { ApiRequest } from '../../types/index.js';

// ============================================================================
// Types
// ============================================================================

interface SchemaManager {
  getTables(): any[];
  getTable(id: string): any;
  createTable(def: any): Promise<any>;
  updateTable(id: string, updates: any): Promise<any>;
  dropTable(id: string): Promise<boolean>;
  addColumn(tableId: string, col: any): Promise<any>;
  updateColumn(tableId: string, colId: string, updates: any): Promise<any>;
  dropColumn(tableId: string, colId: string): Promise<boolean>;
  createLink(def: any): Promise<any>;
  removeLink(tableId: string, colId: string): Promise<boolean>;
  exportSchema(): any;
  importSchema(schema: any, options?: any): Promise<void>;
  save(): Promise<void>;
  load(): Promise<void>;
}

interface TableContext {
  schemaManager: SchemaManager;
  projectId: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateTableSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional(),
  columns: z.array(z.object({
    title: z.string(),
    uidt: z.string(),
  }).passthrough()).optional(),
});

const UpdateTableSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  hints: z.record(z.unknown()).optional(),
});

const CreateColumnSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  uidt: z.string().min(1, 'Column type (uidt) is required'),
}).passthrough();

const UpdateColumnSchema = z.object({
  title: z.string().optional(),
}).passthrough();

const CreateLinkSchema = z.object({
  sourceTableId: z.string().min(1),
  targetTableId: z.string().min(1),
  linkColumnTitle: z.string().min(1),
}).passthrough();

const ImportSchemaSchema = z.object({
  schema: z.object({
    tables: z.array(z.any()),
  }).passthrough(),
  merge: z.boolean().optional(),
});

const SaveTableSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  hints: z.record(z.unknown()).optional(),
  columns: z.array(z.any()).optional(),
});

// ============================================================================
// AgentDB Dynamic Import
// ============================================================================

let agentDbModule: any = null;

async function getAgentDb(): Promise<any> {
  if (!agentDbModule) {
    try {
      // @ts-ignore - Dynamic import of optional dependency
      agentDbModule = await import('@workspace/agentdb');
    } catch {
      throw new Error('AgentDB module not available');
    }
  }
  return agentDbModule;
}

/**
 * Get or create SchemaManager for a project
 */
async function getSchemaManager(projectId: string): Promise<SchemaManager> {
  const agentDb = await getAgentDb();
  const db = getDb();

  const manager = agentDb.createPersistentSchemaManager({
    db,
    namespace: `project:${projectId}`,
    autoSave: true,
  });

  try {
    await manager.load();
  } catch {
    // No existing schema, that's fine
  }

  return manager;
}

// ============================================================================
// Helper Functions
// ============================================================================

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })));
  }
  return result.data;
}

function requireAuth(req: Request): string {
  const apiReq = req as ApiRequest;
  if (!apiReq.user?.id) {
    throw new AuthenticationError('Authentication required');
  }
  return apiReq.user.id;
}

function getContext(req: Request): TableContext {
  const ctx = (req as any).tableContext as TableContext;
  if (!ctx) {
    throw new Error('Table context not initialized');
  }
  return ctx;
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Middleware to attach SchemaManager to request
 */
export async function tableContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const projectId = req.params.projectId || (req as ApiRequest).ncProjectId;
    if (!projectId) {
      res.status(400).json({ success: false, error: { code: 'VAL_001', message: 'Project ID is required' } });
      return;
    }

    const schemaManager = await getSchemaManager(projectId);
    (req as any).tableContext = { schemaManager, projectId } as TableContext;
    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Table CRUD
// ============================================================================

/**
 * GET /tables - List all tables
 */
async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const { schemaManager } = getContext(req);
    const tables = schemaManager.getTables();

    const simplifiedTables = tables.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      columnCount: t.columns?.length || 0,
    }));

    sendList(res, simplifiedTables, {
      total: simplifiedTables.length,
      page: 1,
      pageSize: simplifiedTables.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /tables/:tableId - Get table with columns
 */
async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const { schemaManager } = getContext(req);
    const table = schemaManager.getTable(tableId);
    
    if (!table) {
      throw new NotFoundError('Table', tableId);
    }

    sendSuccess(res, table);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tables - Create new table
 */
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(CreateTableSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'create');

    const { schemaManager } = getContext(req);
    const table = await schemaManager.createTable(body);

    sendCreated(res, table);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /tables/:tableId - Update table
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId } = req.params;
    const body = validateBody(UpdateTableSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const table = await schemaManager.updateTable(tableId, body);

    sendSuccess(res, table);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /tables/:tableId - Delete table
 */
async function deleteTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'delete');

    const { schemaManager } = getContext(req);
    const deleted = await schemaManager.dropTable(tableId);
    
    if (!deleted) {
      throw new NotFoundError('Table', tableId);
    }

    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Column CRUD
// ============================================================================

/**
 * POST /tables/:tableId/columns - Add column
 */
async function createColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId } = req.params;
    const body = validateBody(CreateColumnSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const column = await schemaManager.addColumn(tableId, body);

    sendCreated(res, column);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /tables/:tableId/columns/:columnId - Update column
 */
async function updateColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId, columnId } = req.params;
    const body = validateBody(UpdateColumnSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const column = await schemaManager.updateColumn(tableId, columnId, body);

    sendSuccess(res, column);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /tables/:tableId/columns/:columnId - Delete column
 */
async function deleteColumn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId, columnId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const deleted = await schemaManager.dropColumn(tableId, columnId);
    
    if (!deleted) {
      throw new NotFoundError('Column', columnId);
    }

    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Links
// ============================================================================

/**
 * POST /tables/links - Create link between tables
 */
async function createLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(CreateLinkSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const result = await schemaManager.createLink(body);

    sendCreated(res, result);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /tables/:tableId/links/:columnId - Remove link
 */
async function deleteLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId, columnId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const deleted = await schemaManager.removeLink(tableId, columnId);
    
    if (!deleted) {
      throw new NotFoundError('Link', columnId);
    }

    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Route Handlers - Schema Operations
// ============================================================================

/**
 * GET /tables/schema/export - Export schema
 */
async function exportSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const { schemaManager } = getContext(req);
    const schema = schemaManager.exportSchema();

    sendSuccess(res, schema);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tables/schema/import - Import schema
 */
async function importSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(ImportSchemaSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    await schemaManager.importSchema(body.schema, { merge: body.merge === true });

    sendSuccess(res, { 
      success: true, 
      tableCount: body.schema.tables.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tables/schema/save - Save all schema changes
 */
async function saveSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    await schemaManager.save();

    const schema = schemaManager.exportSchema();
    sendSuccess(res, {
      success: true,
      tableCount: schema.tables?.length || 0,
      schema,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /tables/:tableId/save - Save single table schema
 */
async function saveTable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, tableId } = req.params;
    const body = validateBody(SaveTableSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const { schemaManager } = getContext(req);
    const table = schemaManager.getTable(tableId);
    
    if (!table) {
      throw new NotFoundError('Table', tableId);
    }

    // Update table metadata if provided
    if (body.title !== undefined || body.description !== undefined || body.hints !== undefined) {
      await schemaManager.updateTable(tableId, {
        title: body.title,
        description: body.description,
        hints: body.hints,
      });
    }

    // Update columns if provided
    if (body.columns && Array.isArray(body.columns)) {
      for (const col of body.columns) {
        if (col.id) {
          await schemaManager.updateColumn(tableId, col.id, col);
        } else {
          await schemaManager.addColumn(tableId, col);
        }
      }
    }

    // Save changes
    await schemaManager.save();

    const updated = schemaManager.getTable(tableId);
    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createTableRouter(): Router {
  const router = Router({ mergeParams: true });

  // Apply context middleware
  router.use(tableContextMiddleware);

  // Table CRUD
  router.get('/', list);
  router.post('/', create);
  router.get('/:tableId', get);
  router.patch('/:tableId', update);
  router.delete('/:tableId', deleteTable);

  // Column CRUD
  router.post('/:tableId/columns', createColumn);
  router.patch('/:tableId/columns/:columnId', updateColumn);
  router.delete('/:tableId/columns/:columnId', deleteColumn);

  // Links
  router.post('/links', createLink);
  router.delete('/:tableId/links/:columnId', deleteLink);

  // Schema operations
  router.get('/schema/export', exportSchema);
  router.post('/schema/import', importSchema);
  router.post('/schema/save', saveSchema);

  // Table save
  router.post('/:tableId/save', saveTable);

  return router;
}

// Export for backward compatibility
export {
  saveSchema as schemaSave,
  saveTable as tableSave,
};

export default createTableRouter;
