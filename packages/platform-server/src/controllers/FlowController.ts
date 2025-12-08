/**
 * Flow Controller
 * Handles workflow/flow management endpoints
 * @module controllers/FlowController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { FlowService, type CreateFlowInput, type UpdateFlowInput } from '../services/FlowService.js';
import { ProjectService } from '../services/ProjectService.js';
import { sendSuccess, sendCreated, sendList } from '../utils/response.js';
import { ValidationError, AuthenticationError, NotFoundError } from '../errors/index.js';
import type { ApiRequest, FlowTriggerType } from '../types/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const TriggerTypeSchema = z.enum(['manual', 'schedule', 'webhook', 'record', 'form']);

const CreateFlowSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  trigger_type: TriggerTypeSchema.optional(),
  group_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const UpdateFlowSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  trigger_type: TriggerTypeSchema.optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().optional(),
  group_id: z.string().nullable().optional(),
  fk_schema_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const SaveFlowSchema = z.object({
  title: z.string().max(255).optional(),
  trigger_type: TriggerTypeSchema.optional(),
  enabled: z.boolean().optional(),
  meta: z.record(z.unknown()).optional(),
});

const ReorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    order: z.number().int(),
  })),
});

const MoveToGroupSchema = z.object({
  group_id: z.string().nullable().optional(),
});

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

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /flows - List flows in project
 */
async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const { groupId } = req.query;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const flows = await FlowService.listForProject(projectId, groupId as string | undefined);

    sendList(res, flows, {
      total: flows.length,
      page: 1,
      pageSize: flows.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /flows/:flowId - Get flow by ID
 */
async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const flow = await FlowService.getByIdOrFail(flowId);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows - Create new flow
 */
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(CreateFlowSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'create');

    const flow = await FlowService.createFlow({
      project_id: projectId,
      ...body,
    } as CreateFlowInput);

    sendCreated(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /flows/:flowId - Update flow
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;
    const body = validateBody(UpdateFlowSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const flow = await FlowService.updateFlow(flowId, body as UpdateFlowInput);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /flows/:flowId - Delete flow
 */
async function deleteFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'delete');

    await FlowService.deleteFlow(flowId);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/:flowId/save - Save flow schema
 */
async function save(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;
    const body = validateBody(SaveFlowSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const flow = await FlowService.saveFlow(flowId, body);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/:flowId/publish - Publish flow
 */
async function publish(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'publish');

    const flow = await FlowService.publish(flowId);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/:flowId/enable - Enable flow
 */
async function enable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const flow = await FlowService.enable(flowId);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/:flowId/disable - Disable flow
 */
async function disable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const flow = await FlowService.disable(flowId);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/reorder - Reorder flows
 */
async function reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(ReorderSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    await FlowService.reorder(projectId, body.orders);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /flows/:flowId/move-to-group - Move flow to group
 */
async function moveToGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, flowId } = req.params;
    const body = validateBody(MoveToGroupSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const flow = await FlowService.moveToGroup(flowId, body.group_id ?? null);
    sendSuccess(res, flow);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createFlowRouter(): Router {
  const router = Router({ mergeParams: true });

  // Flow CRUD
  router.get('/', list);
  router.post('/', create);
  router.post('/reorder', reorder);
  router.get('/:flowId', get);
  router.patch('/:flowId', update);
  router.delete('/:flowId', deleteFlow);

  // Flow actions
  router.post('/:flowId/save', save);
  router.post('/:flowId/publish', publish);
  router.post('/:flowId/enable', enable);
  router.post('/:flowId/disable', disable);
  router.post('/:flowId/move-to-group', moveToGroup);

  return router;
}

// Export for backward compatibility and testing
export {
  list as flowList,
  get as flowGet,
  create as flowCreate,
  update as flowUpdate,
  deleteFlow as flowDelete,
  save as flowSave,
};

export default createFlowRouter;
