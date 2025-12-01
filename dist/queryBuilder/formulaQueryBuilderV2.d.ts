import type { Knex } from 'knex';
import { TableType } from '../interface/types';
/**
 * Build SQL expression from formula string
 * @param formula - Formula string
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 * @returns SQL expression string
 */
export declare function formulaQueryBuilderV2(formula: string, model: TableType, models: TableType[], dbDriver: Knex): Promise<string>;
//# sourceMappingURL=formulaQueryBuilderV2.d.ts.map