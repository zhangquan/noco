/**
 * API Module
 * Centralized API exports with new controller architecture
 * @module api
 */

// ============================================================================
// Base Classes
// ============================================================================

export {
  BaseController,
  asyncHandler,
  createHandler,
  type HandlerContext,
  type ControllerHandler,
  type ValidationSchemas,
  type ActionOptions,
} from './base/index.js';

// ============================================================================
// Controllers and Router Factories
// ============================================================================

export {
  // Auth
  createAuthRouter,
  signup,
  signin,
  // User
  createUserRouter,
  me,
  // Project
  createProjectRouter,
  projectList,
  projectGet,
  projectCreate,
  projectUpdate,
  projectDelete,
  // Page
  createPageRouter,
  pageList,
  pageGet,
  pageCreate,
  pageUpdate,
  pageDelete,
  pageSave,
  // Flow
  createFlowRouter,
  flowList,
  flowGet,
  flowCreate,
  flowUpdate,
  flowDelete,
  flowSave,
  // Table
  createTableRouter,
  tableContextMiddleware,
  schemaSave,
  tableSave,
} from './controllers/index.js';
