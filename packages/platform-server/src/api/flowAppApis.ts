/**
 * Flow App APIs
 * @module api/flowAppApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { FlowApp, Flow } from '../models/Flow.js';
import type { ApiRequest, FlowTriggerType } from '../types/index.js';

// ============================================================================
// FlowApp Handlers
// ============================================================================

/**
 * List flow apps in a project
 */
export async function flowAppList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;

    const flowApps = await FlowApp.listForProject(projectId);

    res.json({
      list: flowApps.map(f => f.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get flow app by ID
 */
export async function flowAppGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;

    const flowApp = await FlowApp.get(flowAppId);
    if (!flowApp) {
      res.status(404).json({ error: 'Flow app not found' });
      return;
    }

    res.json(flowApp.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new flow app
 */
export async function flowAppCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { title, trigger_type, meta } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Flow app title is required' });
      return;
    }

    const flowApp = await FlowApp.insert({
      project_id: projectId,
      title,
      trigger_type: trigger_type as FlowTriggerType,
      meta,
    });

    res.status(201).json(flowApp.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Update a flow app
 */
export async function flowAppUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;
    const { title, trigger_type, enabled, meta } = req.body;

    const flowApp = await FlowApp.get(flowAppId);
    if (!flowApp) {
      res.status(404).json({ error: 'Flow app not found' });
      return;
    }

    await FlowApp.update(flowAppId, {
      title,
      trigger_type: trigger_type as FlowTriggerType,
      enabled,
      meta,
    });

    const updated = await FlowApp.get(flowAppId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a flow app
 */
export async function flowAppDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;

    const flowApp = await FlowApp.get(flowAppId);
    if (!flowApp) {
      res.status(404).json({ error: 'Flow app not found' });
      return;
    }

    await FlowApp.delete(flowAppId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Flow (Version) Handlers
// ============================================================================

/**
 * List flows in a flow app
 */
export async function flowList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;

    const flows = await Flow.listForFlowApp(flowAppId);

    res.json({
      list: flows.map(f => f.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get flow by ID
 */
export async function flowGet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    res.json(flow.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Get latest flow for a flow app
 */
export async function flowGetLatest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;

    const flow = await Flow.getLatest(flowAppId);
    if (!flow) {
      res.status(404).json({ error: 'No flows found' });
      return;
    }

    res.json(flow.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new flow version
 */
export async function flowCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;
    const { title, definition } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Flow title is required' });
      return;
    }

    // Verify flow app exists
    const flowApp = await FlowApp.get(flowAppId);
    if (!flowApp) {
      res.status(404).json({ error: 'Flow app not found' });
      return;
    }

    const flow = await Flow.insert({
      flow_app_id: flowAppId,
      title,
      definition,
    });

    res.status(201).json(flow.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Update a flow
 */
export async function flowUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;
    const { title, definition, status } = req.body;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    await Flow.update(flowId, { title, definition, status });

    const updated = await Flow.get(flowId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a flow
 */
export async function flowDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    await Flow.delete(flowId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Save flow definition/schema
 * This is the main API for saving flow definition
 */
export async function flowSave(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;
    const { definition, title } = req.body;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    // Build update object - only include provided fields
    const updateData: Record<string, any> = {};
    if (definition !== undefined) updateData.definition = definition;
    if (title !== undefined) updateData.title = title;

    await Flow.update(flowId, updateData);

    const updated = await Flow.get(flowId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Save flow app schema/meta
 * This is the main API for saving flow app configuration
 */
export async function flowAppSave(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowAppId } = req.params;
    const { title, trigger_type, enabled, meta } = req.body;

    const flowApp = await FlowApp.get(flowAppId);
    if (!flowApp) {
      res.status(404).json({ error: 'Flow app not found' });
      return;
    }

    // Build update object - only include provided fields
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type as FlowTriggerType;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (meta !== undefined) updateData.meta = meta;

    await FlowApp.update(flowAppId, updateData);

    const updated = await FlowApp.get(flowAppId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createFlowAppRouter(): Router {
  const router = Router({ mergeParams: true });

  // FlowApp CRUD
  router.get('/', flowAppList);
  router.post('/', flowAppCreate);
  router.get('/:flowAppId', flowAppGet);
  router.patch('/:flowAppId', flowAppUpdate);
  router.delete('/:flowAppId', flowAppDelete);
  router.post('/:flowAppId/save', flowAppSave);

  // Flow (Version) CRUD
  router.get('/:flowAppId/flows', flowList);
  router.get('/:flowAppId/flows/latest', flowGetLatest);
  router.post('/:flowAppId/flows', flowCreate);
  router.get('/:flowAppId/flows/:flowId', flowGet);
  router.patch('/:flowAppId/flows/:flowId', flowUpdate);
  router.delete('/:flowAppId/flows/:flowId', flowDelete);
  router.post('/:flowAppId/flows/:flowId/save', flowSave);

  return router;
}

export default createFlowAppRouter;
