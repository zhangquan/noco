/**
 * Services Module
 * Business logic layer providing standardized operations
 * @module services
 */

// Base Service
export {
  BaseService,
  type BaseEntity,
  type ServiceOptions,
  type ListOptions,
  type PaginatedResult,
} from './BaseService.js';

// User Service
export {
  UserService,
  type CreateUserInput,
  type UpdateUserInput,
  type SignupInput,
  type SigninInput,
  type AuthResult,
  type SafeUser,
} from './UserService.js';

// Project Service
export {
  ProjectService,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectWithRole,
  type ProjectUserInfo,
} from './ProjectService.js';

// Page Service
export {
  PageService,
  type CreatePageInput,
  type UpdatePageInput,
  type ReorderItem as PageReorderItem,
} from './PageService.js';

// Flow Service
export {
  FlowService,
  type CreateFlowInput,
  type UpdateFlowInput,
  type ReorderItem as FlowReorderItem,
} from './FlowService.js';
