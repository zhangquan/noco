/**
 * Table/Model APIs
 * Uses agentdb SchemaManager for table/column management
 * @module meta/api/tableApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Knex } from 'knex';
import {
  SchemaManager,
  createPersistentSchemaManager,
  type TableDefinition,
  type ColumnDefinition,
  type LinkDefinition,
} from '@workspace/agentdb';
import { getNcMeta } from '../../lib/NcMetaIO.js';
import type { ApiRequest } from '../../types/index.js';

// ============================================================================
// Types
// ============================================================================

interface TableApiContext {
  schemaManager: SchemaManager;
  projectId: string;
}

// ============================================================================
// Context Middleware
// ============================================================================

/**
 * Get or create SchemaManager for a project
 */
async function getSchemaManager(projectId: string): Promise<SchemaManager> {
  const ncMeta = getNcMeta();
  const db = ncMeta.getKnex();

  const manager = createPersistentSchemaManager({
    db,
    namespace: `project:${projectId}`,
    autoSave: true,
  });

  // Load existing schema
  try {
    await manager.load();
  } catch {
    // No existing schema, that's fine
  }

  return manager;
}

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
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    const schemaManager = await getSchemaManager(projectId);
    (req as any).tableContext = { schemaManager, projectId };
    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Table Handlers
// ============================================================================

/**
 * List all tables in a project
 */
export async function tableList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const tables = schemaManager.getTables();

    res.json({
      list: tables.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        columnCount: t.columns?.length || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a table with columns
 */
export async function tableGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId } = req.params;

    const table = schemaManager.getTable(tableId);
    if (!table) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    res.json(table);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new table
 */
export async function tableCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { title, description, columns } = req.body as TableDefinition;

    if (!title) {
      res.status(400).json({ error: 'Table title is required' });
      return;
    }

    const table = await schemaManager.createTable({
      title,
      description,
      columns,
    });

    res.status(201).json(table);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a table
 */
export async function tableUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId } = req.params;
    const { title, description, hints } = req.body;

    const table = await schemaManager.updateTable(tableId, {
      title,
      description,
      hints,
    });

    res.json(table);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a table
 */
export async function tableDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId } = req.params;

    const deleted = await schemaManager.dropTable(tableId);
    if (!deleted) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Column Handlers
// ============================================================================

/**
 * Add column to table
 */
export async function columnCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId } = req.params;
    const columnDef = req.body as ColumnDefinition;

    if (!columnDef.title || !columnDef.uidt) {
      res.status(400).json({ error: 'Column title and type (uidt) are required' });
      return;
    }

    const column = await schemaManager.addColumn(tableId, columnDef);
    res.status(201).json(column);
  } catch (error) {
    next(error);
  }
}

/**
 * Update column
 */
export async function columnUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId, columnId } = req.params;
    const updates = req.body as Partial<ColumnDefinition>;

    const column = await schemaManager.updateColumn(tableId, columnId, updates);
    res.json(column);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete column
 */
export async function columnDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId, columnId } = req.params;

    const deleted = await schemaManager.dropColumn(tableId, columnId);
    if (!deleted) {
      res.status(404).json({ error: 'Column not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Link Handlers
// ============================================================================

/**
 * Create a link between tables
 */
export async function linkCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const linkDef = req.body as LinkDefinition;

    if (!linkDef.sourceTableId || !linkDef.targetTableId || !linkDef.linkColumnTitle) {
      res.status(400).json({
        error: 'sourceTableId, targetTableId, and linkColumnTitle are required',
      });
      return;
    }

    const result = await schemaManager.createLink(linkDef);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Remove a link
 */
export async function linkDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { tableId, columnId } = req.params;

    const deleted = await schemaManager.removeLink(tableId, columnId);
    if (!deleted) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Schema Import/Export
// ============================================================================

/**
 * Export schema
 */
export async function schemaExport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const schema = schemaManager.exportSchema();
    res.json(schema);
  } catch (error) {
    next(error);
  }
}

/**
 * Import schema
 */
export async function schemaImport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { schemaManager } = (req as any).tableContext as TableApiContext;
    const { schema, merge } = req.body;

    if (!schema || !schema.tables) {
      res.status(400).json({ error: 'Invalid schema format' });
      return;
    }

    await schemaManager.importSchema(schema, { merge: merge === true });
    res.json({ success: true, tableCount: schema.tables.length });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createTableRouter(): Router {
  const router = Router({ mergeParams: true });

  // Apply context middleware
  router.use(tableContextMiddleware);

  // Table CRUD
  router.get('/', tableList);
  router.post('/', tableCreate);
  router.get('/:tableId', tableGet);
  router.patch('/:tableId', tableUpdate);
  router.delete('/:tableId', tableDelete);

  // Column CRUD
  router.post('/:tableId/columns', columnCreate);
  router.patch('/:tableId/columns/:columnId', columnUpdate);
  router.delete('/:tableId/columns/:columnId', columnDelete);

  // Links
  router.post('/links', linkCreate);
  router.delete('/:tableId/links/:columnId', linkDelete);

  // Schema import/export
  router.get('/schema/export', schemaExport);
  router.post('/schema/import', schemaImport);

  return router;
}

export default createTableRouter;
