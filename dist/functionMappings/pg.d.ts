import { SqlFunctionBuilder } from './commonFns';
/**
 * PostgreSQL-specific function mappings
 */
export declare const pgFns: Record<string, SqlFunctionBuilder>;
/**
 * Get function by name (case-insensitive)
 */
export declare function getFunction(name: string): SqlFunctionBuilder | undefined;
/**
 * Check if a function exists
 */
export declare function hasFunction(name: string): boolean;
/**
 * Get all available function names
 */
export declare function getFunctionNames(): string[];
//# sourceMappingURL=pg.d.ts.map