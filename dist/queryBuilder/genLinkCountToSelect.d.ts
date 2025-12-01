import type { Knex } from 'knex';
import { ColumnType, TableType } from '../interface/types';
interface GenLinkCountParams {
    modelId: string;
    column: ColumnType;
    models: TableType[];
    dbDriver: Knex;
    alias?: string;
}
/**
 * Generate subquery for link count (Links column)
 * @param params - Parameters for link count generation
 * @returns Knex subquery or raw expression
 */
export declare function genLinkCountToSelect(params: GenLinkCountParams): Knex.QueryBuilder | Knex.Raw;
export {};
//# sourceMappingURL=genLinkCountToSelect.d.ts.map