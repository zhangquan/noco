import type { Knex } from 'knex';
/**
 * Common function type for SQL generation
 */
export type SqlFunctionBuilder = (args: string[], dbDriver: Knex) => string | Knex.Raw;
/**
 * Common logical and utility functions
 * These are database-agnostic and work with standard SQL
 */
export declare const commonFns: Record<string, SqlFunctionBuilder>;
//# sourceMappingURL=commonFns.d.ts.map