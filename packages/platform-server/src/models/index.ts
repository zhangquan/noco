/**
 * Models Module
 * @module models
 */

// Base model class (for extending)
export {
  BaseModel,
  CacheKey,
  type ModelOptions,
  type QueryOptions,
} from './BaseModel.js';

// Legacy table helpers (for backward compatibility)
export { type TableOptions } from './Table.js';

// Entity models
export { User } from './User.js';
export { Project } from './Project.js';
export { Page } from './Page.js';
export { Flow } from './Flow.js';
