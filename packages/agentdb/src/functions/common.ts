/**
 * Common SQL functions (database-agnostic)
 * @module functions/common
 */

import type { Knex } from 'knex';

/**
 * SQL function builder type
 */
export type SqlFn = (args: string[], db: Knex) => string | Knex.Raw;

/**
 * Common logical and utility functions
 */
export const commonFunctions: Record<string, SqlFn> = {
  // ==========================================================================
  // Logical Functions
  // ==========================================================================

  IF: (args) => {
    if (args.length < 3) {
      return `CASE WHEN ${args[0] || 'NULL'} THEN ${args[1] || 'NULL'} ELSE NULL END`;
    }
    return `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`;
  },

  SWITCH: (args) => {
    if (args.length < 2) return 'NULL';

    const expr = args[0];
    const cases: string[] = [];

    for (let i = 1; i < args.length - 1; i += 2) {
      cases.push(`WHEN ${args[i]} THEN ${args[i + 1]}`);
    }

    const defaultValue = args.length % 2 === 0 ? args[args.length - 1] : 'NULL';
    return `CASE ${expr} ${cases.join(' ')} ELSE ${defaultValue} END`;
  },

  AND: (args) => (args.length === 0 ? 'TRUE' : `(${args.join(' AND ')})`),
  OR: (args) => (args.length === 0 ? 'FALSE' : `(${args.join(' OR ')})`),
  NOT: (args) => `NOT (${args[0] || 'NULL'})`,

  TRUE: () => 'TRUE',
  FALSE: () => 'FALSE',

  // ==========================================================================
  // Comparison Functions
  // ==========================================================================

  ISBLANK: (args) => `(${args[0]} IS NULL OR ${args[0]} = '')`,
  ISERROR: () => 'FALSE',
  ISNULL: (args) => `(${args[0]} IS NULL)`,

  COALESCE: (args) => `COALESCE(${args.join(', ')})`,
  NULLIF: (args) => `NULLIF(${args[0] || 'NULL'}, ${args[1] || 'NULL'})`,

  EQUAL: (args) => `(${args[0]} = ${args[1]})`,
  GREATER: (args) => `(${args[0]} > ${args[1]})`,
  LESS: (args) => `(${args[0]} < ${args[1]})`,
  GREATEREQUAL: (args) => `(${args[0]} >= ${args[1]})`,
  LESSEQUAL: (args) => `(${args[0]} <= ${args[1]})`,

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  BLANK: () => "''",
  ERROR: () => 'NULL',
  RECORD_ID: () => 'id',
  CREATED_TIME: () => 'created_at',
  LAST_MODIFIED_TIME: () => 'updated_at',
  CREATED_BY: () => 'created_by',
  LAST_MODIFIED_BY: () => 'updated_by',
};
