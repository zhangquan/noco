/**
 * Controllers Module
 * Centralized controller exports with standardized patterns
 * @module controllers
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
// Auth Controller
// ============================================================================

export {
  createAuthRouter,
  signup,
  signin,
  refreshToken,
  forgotPassword,
  resetPassword,
} from './AuthController.js';

// ============================================================================
// User Controller
// ============================================================================

export {
  createUserRouter,
  me,
  updateProfile,
  changePassword,
  list as userList,
  get as userGet,
  update as userUpdate,
  deleteUser,
} from './UserController.js';

// ============================================================================
// Project Controller
// ============================================================================

export {
  createProjectRouter,
  projectList,
  projectGet,
  projectCreate,
  projectUpdate,
  projectDelete,
} from './ProjectController.js';

// ============================================================================
// Page Controller
// ============================================================================

export {
  createPageRouter,
  pageList,
  pageGet,
  pageCreate,
  pageUpdate,
  pageDelete,
  pageSave,
} from './PageController.js';

// ============================================================================
// Flow Controller
// ============================================================================

export {
  createFlowRouter,
  flowList,
  flowGet,
  flowCreate,
  flowUpdate,
  flowDelete,
  flowSave,
} from './FlowController.js';

// ============================================================================
// Table Controller
// ============================================================================

export {
  createTableRouter,
  tableContextMiddleware,
  schemaSave,
  tableSave,
} from './TableController.js';
