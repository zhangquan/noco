/**
 * Schema management module
 * @module schema
 */

export {
  SchemaManager,
  createSchemaManager,
  createPersistentSchemaManager,
  loadSchemaManager,
  type ISchemaManager,
  type ColumnDefinition,
  type TableDefinition,
  type LinkDefinition,
  type SchemaExport,
  type SchemaManagerOptions,
} from './SchemaManager';

export {
  SchemaStore,
  createSchemaStore,
  type ISchemaStore,
  type SchemaRecord,
  type SchemaData,
  type SchemaStoreOptions,
} from './SchemaStore';
