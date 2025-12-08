/**
 * Page APIs
 * @module api/pageApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { Page } from '../models/Page.js';
import { Project } from '../models/Project.js';
import type { ApiRequest } from '../types/index.js';

// ============================================================================
// Page Handlers
// ============================================================================

/**
 * List pages in a project
 */
export async function pageList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { groupId } = req.query;

    const pages = await Page.listForProject(projectId, groupId as string | undefined);

    res.json({
      list: pages.map(p => p.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get page by ID
 */
export async function pageGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    res.json(page.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Get page by route
 */
export async function pageGetByRoute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { route } = req.query;

    if (!route || typeof route !== 'string') {
      res.status(400).json({ error: 'Route query parameter is required' });
      return;
    }

    const page = await Page.getByRoute(projectId, route);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    res.json(page.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new page
 */
export async function pageCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { title, route, group_id, meta } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Page title is required' });
      return;
    }

    // Verify project exists
    const project = await Project.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const page = await Page.insert({
      project_id: projectId,
      title,
      route,
      group_id,
      meta,
    });

    res.status(201).json(page.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Update a page
 */
export async function pageUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;
    const { title, route, order, group_id, fk_schema_id, meta } = req.body;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    await Page.update(pageId, { title, route, order, group_id, fk_schema_id, meta });

    const updated = await Page.get(pageId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a page
 */
export async function pageDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    await Page.delete(pageId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder pages in a project
 */
export async function pageReorder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      res.status(400).json({ error: 'Orders must be an array' });
      return;
    }

    await Page.reorder(projectId, orders);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Duplicate a page
 */
export async function pageDuplicate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;
    const { newTitle } = req.body;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const duplicated = await Page.insert({
      project_id: page.projectId,
      title: newTitle || `${page.title} (Copy)`,
      route: undefined, // Will be auto-generated
      group_id: page.groupId,
      meta: page.meta,
    });

    res.status(201).json(duplicated.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Save page schema (meta)
 * This is the main API for saving page definition/schema
 */
export async function pageSave(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;
    const { meta, title, route } = req.body;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    // Build update object - only include provided fields
    const updateData: Record<string, any> = {};
    if (meta !== undefined) updateData.meta = meta;
    if (title !== undefined) updateData.title = title;
    if (route !== undefined) updateData.route = route;

    await Page.update(pageId, updateData);

    const updated = await Page.get(pageId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Move page to a group
 */
export async function pageMoveToGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pageId } = req.params;
    const { group_id } = req.body;

    const page = await Page.get(pageId);
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    await Page.moveToGroup(pageId, group_id || null);

    const updated = await Page.get(pageId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createPageRouter(): Router {
  const router = Router({ mergeParams: true });

  // Page CRUD
  router.get('/', pageList);
  router.get('/by-route', pageGetByRoute);
  router.post('/', pageCreate);
  router.post('/reorder', pageReorder);
  router.get('/:pageId', pageGet);
  router.patch('/:pageId', pageUpdate);
  router.delete('/:pageId', pageDelete);
  router.post('/:pageId/duplicate', pageDuplicate);
  router.post('/:pageId/save', pageSave);
  router.post('/:pageId/move-to-group', pageMoveToGroup);

  return router;
}

export default createPageRouter;
