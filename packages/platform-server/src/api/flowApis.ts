/**
 * Flow APIs
 * @module api/flowApis
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { Flow } from '../models/Flow.js';
import { Project } from '../models/Project.js';
import type { ApiRequest, FlowTriggerType } from '../types/index.js';

// ============================================================================
// Flow Handlers
// ============================================================================

/**
 * List flows in a project
 */
export async function flowList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { groupId } = req.query;

    const flows = await Flow.listForProject(projectId, groupId as string | undefined);

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
 * Create a new flow
 */
export async function flowCreate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId } = req.params;
    const { title, trigger_type, group_id, meta } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Flow title is required' });
      return;
    }

    // Verify project exists
    const project = await Project.get(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const flow = await Flow.insert({
      project_id: projectId,
      title,
      trigger_type: trigger_type as FlowTriggerType,
      group_id,
      meta,
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
    const { title, trigger_type, enabled, order, group_id, fk_schema_id, meta } = req.body;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    await Flow.update(flowId, {
      title,
      trigger_type: trigger_type as FlowTriggerType,
      enabled,
      order,
      group_id,
      fk_schema_id,
      meta,
    });

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
 * Reorder flows in a project
 */
export async function flowReorder(
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

    await Flow.reorder(projectId, orders);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * Save flow schema (meta)
 * This is the main API for saving flow definition/schema
 */
export async function flowSave(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;
    const { title, trigger_type, enabled, meta } = req.body;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    // Build update object - only include provided fields
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (trigger_type !== undefined) updateData.trigger_type = trigger_type as FlowTriggerType;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (meta !== undefined) updateData.meta = meta;

    await Flow.update(flowId, updateData);

    const updated = await Flow.get(flowId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Publish a flow
 */
export async function flowPublish(
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

    await Flow.publish(flowId);

    const updated = await Flow.get(flowId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

/**
 * Move flow to a group
 */
export async function flowMoveToGroup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { flowId } = req.params;
    const { group_id } = req.body;

    const flow = await Flow.get(flowId);
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }

    await Flow.moveToGroup(flowId, group_id || null);

    const updated = await Flow.get(flowId);
    res.json(updated?.toJSON());
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router
// ============================================================================

export function createFlowRouter(): Router {
  const router = Router({ mergeParams: true });

  // Flow CRUD
  router.get('/', flowList);
  router.post('/', flowCreate);
  router.post('/reorder', flowReorder);
  router.get('/:flowId', flowGet);
  router.patch('/:flowId', flowUpdate);
  router.delete('/:flowId', flowDelete);
  router.post('/:flowId/save', flowSave);
  router.post('/:flowId/publish', flowPublish);
  router.post('/:flowId/move-to-group', flowMoveToGroup);

  return router;
}

export default createFlowRouter;
