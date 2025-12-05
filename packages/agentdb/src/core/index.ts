/**
 * Core module barrel export
 * @module core
 */

// Error handling
export { NcError, ErrorCode, HTTP_STATUS, type NcErrorType } from './NcError';

// Model context
export {
  ModelContext,
  createContext,
  type IModelContext,
  type ModelContextParams,
} from './ModelContext';

// Operations
export {
  // CRUD
  CrudOperations,
  createCrudOperations,
  type ICrudOperations,
  // Links
  LinkOperations,
  createLinkOperations,
  type ILinkOperations,
  // Virtual columns
  VirtualColumnOperations,
  createVirtualColumnOperations,
  type IVirtualColumnOperations,
  // Lazy loading
  LazyOperations,
  createLazyOperations,
  type ILazyOperations,
  // Copy
  CopyOperations,
  createCopyOperations,
  type ICopyOperations,
  type CopyOptions,
  type CopyRelationOptions,
} from './operations';
