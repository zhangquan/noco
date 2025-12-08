/**
 * Models Module
 * @module models
 */

// Table/Model helpers and class
export {
  Model,
  type TableOptions,
  type QueryOptions,
  genId,
  getById,
  getByCondition,
  listRecords,
  insertRecord,
  updateRecord,
  deleteRecord,
  countRecords,
  invalidateListCache,
} from './Table.js';

// Schema model - unified schema management for Table, Page, Flow
export {
  Schema,
  type JsonPatchOp,
  type JsonPatchOperation,
  type SchemaRecord,
  type SchemaCreateOptions,
  type SchemaPatchResult,
} from './Schema.js';

// Entity models
export { User } from './User.js';
export { Project } from './Project.js';
export { Page } from './Page.js';
export { Flow } from './Flow.js';
