/**
 * App APIs
 * @module meta/api/appApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppModel } from '../../models/AppModel.js';
import { Page } from '../../models/Page.js';
import type { ApiRequest, AppType } from '../../types/index.js';

// ============================================================================
// App Handlers
// ============================================================================

/**
 * List apps in a project
 */
export async function appList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { type } = req.query;

    const apps = await AppModel.listForProject(
      projectId,
      type as AppType | undefined
    );

    res.json({
      list: apps.map(a => a.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get app by ID
 */
export async function appGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appId } = req.params;

    const app = await AppModel.get(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    res.json(app.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new app
 */
export async function appCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { title, type, meta } = req.body;

    if (!title) {
      res.status(400).json({ error: 'App title is required' });
      return;
    }

    const app = await AppModel.insert({
      project_id: projectId,
      title,
      type: type || 'page',
      meta,
    });

    res.status(201).json(app.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Update an app
 */
export async function appUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appId } = req.params;
    const { title, order, status, meta } = req.body;

    const app = await AppModel.get(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    await AppModel.update(appId, { title, order, status, meta });

    const updated = await AppModel.get(appId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an app
 */
export async function appDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appId } = req.params;

    const app = await AppModel.get(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    await AppModel.delete(appId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Publish an app
 */
export async function appPublish(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appId } = req.params;

    const app = await AppModel.get(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    await AppModel.publish(appId);

    const updated = await AppModel.get(appId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// App with Pages
// ============================================================================

/**
 * Get app with all pages
 */
export async function appGetWithPages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { appId } = req.params;

    const app = await AppModel.get(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const pages = await Page.listForApp(appId);

    res.json({
      ...app.toJSON(),
      pages: pages.map(p => p.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reorder apps in a project
 */
export async function appReorder(
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

    // Update order for each app
    for (const { id, order } of orders) {
      await AppModel.update(id, { order });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createAppRouter(): Router {
  const router = Router({ mergeParams: true });

  // App CRUD
  router.get('/', appList);
  router.post('/', appCreate);
  router.post('/reorder', appReorder);
  router.get('/:appId', appGet);
  router.get('/:appId/with-pages', appGetWithPages);
  router.patch('/:appId', appUpdate);
  router.delete('/:appId', appDelete);
  router.post('/:appId/publish', appPublish);

  return router;
}

export default createAppRouter;
