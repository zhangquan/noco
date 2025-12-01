import type { Knex } from 'knex';
import { SortType, TableType } from '../interface/types';
/**
 * Apply sort to query builder (V2)
 * @param sortArr - Array of sorts
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 * @param modelAlias - Optional table alias
 */
export declare function sortV2(sortArr: SortType[], qb: Knex.QueryBuilder, model: TableType, models: TableType[], dbDriver: Knex, modelAlias?: string): Promise<void>;
/**
 * Parse sort string into SortType array
 * Format: "+field" or "-field" or "field:asc" or "field:desc"
 */
export declare function parseSortString(sortStr: string, model: TableType): SortType[];
//# sourceMappingURL=sortBuilder.d.ts.map