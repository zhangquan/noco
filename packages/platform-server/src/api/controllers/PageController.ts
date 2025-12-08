/**
 * Page Controller
 * Handles page management endpoints
 * @module api/controllers/PageController
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { PageService, type CreatePageInput, type UpdatePageInput } from '../../services/PageService.js';
import { ProjectService } from '../../services/ProjectService.js';
import { sendSuccess, sendCreated, sendList } from '../../utils/response.js';
import { ValidationError, AuthenticationError, NotFoundError } from '../../errors/index.js';
import type { ApiRequest } from '../../types/index.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreatePageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  route: z.string().max(255).optional(),
  group_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const UpdatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  route: z.string().max(255).optional(),
  order: z.number().int().optional(),
  group_id: z.string().nullable().optional(),
  fk_schema_id: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

const SavePageSchema = z.object({
  title: z.string().max(255).optional(),
  route: z.string().max(255).optional(),
  meta: z.record(z.unknown()).optional(),
});

const ReorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    order: z.number().int(),
  })),
});

const DuplicateSchema = z.object({
  newTitle: z.string().max(255).optional(),
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
 * GET /pages - List pages in project
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

    const pages = await PageService.listForProject(projectId, groupId as string | undefined);

    sendList(res, pages, {
      total: pages.length,
      page: 1,
      pageSize: pages.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /pages/by-route - Get page by route
 */
async function getByRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const { route } = req.query;

    if (!route || typeof route !== 'string') {
      throw new ValidationError('Route query parameter is required');
    }

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const page = await PageService.getByRouteOrFail(projectId, route);
    sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /pages/:pageId - Get page by ID
 */
async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;

    // Check access
    const hasAccess = await ProjectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      throw new NotFoundError('Project', projectId);
    }

    const page = await PageService.getByIdOrFail(pageId);
    sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /pages - Create new page
 */
async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(CreatePageSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'create');

    const page = await PageService.createPage({
      project_id: projectId,
      ...body,
    } as CreatePageInput);

    sendCreated(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /pages/:pageId - Update page
 */
async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;
    const body = validateBody(UpdatePageSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const page = await PageService.updatePage(pageId, body as UpdatePageInput);
    sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /pages/:pageId - Delete page
 */
async function deletePage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'delete');

    await PageService.deletePage(pageId);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /pages/:pageId/save - Save page schema
 */
async function save(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;
    const body = validateBody(SavePageSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const page = await PageService.savePage(pageId, body);
    sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /pages/:pageId/duplicate - Duplicate page
 */
async function duplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;
    const body = validateBody(DuplicateSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'create');

    const page = await PageService.duplicate(pageId, body.newTitle);
    sendCreated(res, page);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /pages/reorder - Reorder pages
 */
async function reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId } = req.params;
    const body = validateBody(ReorderSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    await PageService.reorder(projectId, body.orders);
    sendSuccess(res, { success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /pages/:pageId/move-to-group - Move page to group
 */
async function moveToGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireAuth(req);
    const { projectId, pageId } = req.params;
    const body = validateBody(MoveToGroupSchema, req.body);

    // Check permission
    await ProjectService.requirePermission(projectId, userId, 'update');

    const page = await PageService.moveToGroup(pageId, body.group_id ?? null);
    sendSuccess(res, page);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createPageRouter(): Router {
  const router = Router({ mergeParams: true });

  // Page CRUD
  router.get('/', list);
  router.get('/by-route', getByRoute);
  router.post('/', create);
  router.post('/reorder', reorder);
  router.get('/:pageId', get);
  router.patch('/:pageId', update);
  router.delete('/:pageId', deletePage);

  // Page actions
  router.post('/:pageId/save', save);
  router.post('/:pageId/duplicate', duplicate);
  router.post('/:pageId/move-to-group', moveToGroup);

  return router;
}

// Export for backward compatibility and testing
export {
  list as pageList,
  get as pageGet,
  create as pageCreate,
  update as pageUpdate,
  deletePage as pageDelete,
  save as pageSave,
};

export default createPageRouter;
