import type { Knex } from 'knex';
import { FilterType, TableType } from '../interface/types';
/**
 * Apply filter conditions to query builder (V2)
 * @param conditionObj - Filter or array of filters
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 */
export declare function conditionV2(conditionObj: FilterType | FilterType[], qb: Knex.QueryBuilder, model: TableType, models: TableType[], dbDriver: Knex): Promise<void>;
/**
 * Parse simple where string (legacy format)
 * Format: "field,op,value" or "(field,op,value)~and(field,op,value)"
 */
export declare function parseWhereString(whereStr: string, model: TableType): FilterType[];
//# sourceMappingURL=condition.d.ts.map