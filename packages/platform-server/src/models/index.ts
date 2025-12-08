/**
 * Models Module
 * Pure domain entity classes
 * @module models
 */

// User Entity
export { User } from './User.js';

// Project Entity
export { Project } from './Project.js';

// Page Entity
export { Page } from './Page.js';

// Flow Entity
export { Flow } from './Flow.js';

// Schema Entity (with JSON Patch support)
export {
  Schema,
  type JsonPatchOp,
  type JsonPatchOperation,
  type SchemaRecord,
  type SchemaCreateOptions,
  type SchemaPatchResult,
} from './Schema.js';

// Table/Model Entity
export {
  Model,
  type TableOptions,
  type QueryOptions,
  genId,
} from './Table.js';

// ============================================================================
// Backward Compatibility
// ============================================================================

// Re-export repository functions that were previously in Table.ts
// This maintains backward compatibility for existing code
export {
  // These are now in repositories but re-exported for compatibility
  genId as generateId,
} from './Table.js';
