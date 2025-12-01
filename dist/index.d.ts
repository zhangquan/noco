import type { Knex } from 'knex';
import { LazyloadLinkModelSql } from './impl/LazyloadLinkModelSql';
import { CopySqlImp } from './impl/CopySqlImp';
import type { BaseModelSql } from './interface/BaseModelSql';
import type { LinkModelSql } from './interface/LinkModelSql';
import type { TableType, ModelConfig } from './interface/types';
export * from './interface/types';
export * from './interface/BaseModelSql';
export * from './interface/LinkModelSql';
export * from './interface/NcError';
export * from './abstract/AbstractBaseModelSql';
export * from './abstract/AbstractLinkModelSql';
export * from './impl/JSONModelSqlImp';
export * from './impl/JSONLinkModelSql';
export * from './impl/LazyloadLinkModelSql';
export * from './impl/CopySqlImp';
export * from './helpers/sanitize';
export * from './helpers/queryBuilderHelper';
export * from './helpers/condition';
export * from './helpers/sortBuilder';
export * from './queryBuilder/formulaQueryBuilderV2';
export * from './queryBuilder/genRollupSelectV2';
export * from './queryBuilder/genLinkCountToSelect';
export * from './functionMappings/commonFns';
export * from './functionMappings/pg';
/**
 * Available model types
 */
export type ModelType = 'json' | 'link' | 'lazyload' | 'copy';
/**
 * Factory function parameters
 */
export interface GetBaseModelParams {
    /** Database driver (Knex instance) */
    dbDriver: Knex;
    /** Model/table ID */
    modelId: string;
    /** All models/tables definitions */
    models: TableType[];
    /** Optional view ID */
    viewId?: string;
    /** Optional table alias for queries */
    alias?: string;
    /** Model type to create */
    type?: ModelType;
    /** Optional configuration overrides */
    config?: Partial<ModelConfig>;
}
/**
 * Get a base model instance
 *
 * @param params - Parameters for model creation
 * @returns BaseModelSql & LinkModelSql implementation
 *
 * @example
 * ```typescript
 * const model = getBaseModel({
 *   dbDriver: knex,
 *   modelId: 'table_xyz',
 *   models: allTableDefinitions,
 *   type: 'json' // default
 * });
 *
 * // CRUD operations
 * const record = await model.insert({ name: 'John', email: 'john@example.com' });
 * const records = await model.list({ limit: 10 });
 * await model.updateByPk(record.id, { name: 'Jane' });
 *
 * // Link operations (if using 'json' or 'link' type)
 * await model.mmList({ colId: 'link_col_id', parentRowId: record.id });
 * await model.addChild({ colId: 'link_col_id', rowId: record.id, childId: 'child_id' });
 * ```
 */
export declare function getBaseModel(params: GetBaseModelParams): BaseModelSql & LinkModelSql;
/**
 * Get a link model instance (only link operations)
 *
 * @param params - Parameters for model creation
 * @returns LinkModelSql implementation
 */
export declare function getLinkModel(params: Omit<GetBaseModelParams, 'type'>): LinkModelSql;
/**
 * Get a lazy loading model instance
 *
 * @param params - Parameters for model creation
 * @returns LazyloadLinkModelSql implementation
 */
export declare function getLazyloadModel(params: Omit<GetBaseModelParams, 'type'>): LazyloadLinkModelSql;
/**
 * Get a copy-enabled model instance
 *
 * @param params - Parameters for model creation
 * @returns CopySqlImp implementation
 */
export declare function getCopyModel(params: Omit<GetBaseModelParams, 'type'>): CopySqlImp;
/**
 * Create the required database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are created
 *
 * @example
 * ```typescript
 * await createTables(knex);
 * ```
 */
export declare function createTables(dbDriver: Knex): Promise<void>;
/**
 * Drop the database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are dropped
 */
export declare function dropTables(dbDriver: Knex): Promise<void>;
declare const _default: {
    getBaseModel: typeof getBaseModel;
    getLinkModel: typeof getLinkModel;
    getLazyloadModel: typeof getLazyloadModel;
    getCopyModel: typeof getCopyModel;
    createTables: typeof createTables;
    dropTables: typeof dropTables;
};
export default _default;
//# sourceMappingURL=index.d.ts.map