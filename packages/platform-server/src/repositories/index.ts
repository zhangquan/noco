/**
 * Repositories Module
 * Data access layer for all entities
 * @module repositories
 */

// Base Repository
export {
  BaseRepository,
  genId,
  type RepositoryOptions,
  type QueryOptions,
  type BaseEntity,
} from './BaseRepository.js';

// User Repository
export {
  UserRepository,
  type UserRecord,
  type CreateUserData,
  type UpdateUserData,
} from './UserRepository.js';

// Project Repository
export {
  ProjectRepository,
  type ProjectRecord,
  type CreateProjectData,
  type UpdateProjectData,
  type ProjectUserRecord,
} from './ProjectRepository.js';

// Page Repository
export {
  PageRepository,
  type PageRecord,
  type CreatePageData,
  type UpdatePageData,
} from './PageRepository.js';

// Flow Repository
export {
  FlowRepository,
  type FlowRecord,
  type CreateFlowData,
  type UpdateFlowData,
} from './FlowRepository.js';

// Schema Repository
export {
  SchemaRepository,
  type SchemaRecord,
  type CreateSchemaData,
  type UpdateSchemaData,
} from './SchemaRepository.js';
