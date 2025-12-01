import type { Knex } from 'knex';
import { ColumnType, TableType } from '../interface/types';
interface GenRollupSelectV2Params {
    column: ColumnType;
    model: TableType;
    models: TableType[];
    dbDriver: Knex;
    alias?: string;
}
/**
 * Generate subquery for rollup column
 * @param params - Parameters for rollup generation
 * @returns Knex subquery or raw expression
 */
export declare function genRollupSelectV2(params: GenRollupSelectV2Params): Promise<Knex.QueryBuilder | Knex.Raw>;
export {};
//# sourceMappingURL=genRollupSelectV2.d.ts.map