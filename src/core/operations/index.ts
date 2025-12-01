/**
 * Operations barrel export
 * @module core/operations
 */

export {
  CrudOperations,
  createCrudOperations,
  type ICrudOperations,
} from './CrudOperations';

export {
  LinkOperations,
  createLinkOperations,
  type ILinkOperations,
} from './LinkOperations';

export {
  VirtualColumnOperations,
  createVirtualColumnOperations,
  type IVirtualColumnOperations,
} from './VirtualColumnOperations';

export {
  LazyOperations,
  createLazyOperations,
  type ILazyOperations,
} from './LazyOperations';

export {
  CopyOperations,
  createCopyOperations,
  type ICopyOperations,
  type CopyOptions,
  type CopyRelationOptions,
} from './CopyOperations';
