/**
 * PostgreSQL-specific SQL functions
 * @module functions/postgres
 */

import type { SqlFn } from './common';
import { commonFunctions } from './common';

/**
 * PostgreSQL function mappings
 */
export const postgresFunctions: Record<string, SqlFn> = {
  ...commonFunctions,

  // ==========================================================================
  // String Functions
  // ==========================================================================

  CONCAT: (args) => `CONCAT(${args.join(', ')})`,
  CONCAT_WS: (args) => `CONCAT_WS(${args.join(', ')})`,
  UPPER: (args) => `UPPER(${args[0] || "''"})`,
  LOWER: (args) => `LOWER(${args[0] || "''"})`,
  TRIM: (args) => `TRIM(${args[0] || "''"})`,
  LTRIM: (args) => `LTRIM(${args[0] || "''"})`,
  RTRIM: (args) => `RTRIM(${args[0] || "''"})`,
  LENGTH: (args) => `LENGTH(${args[0] || "''"})`,
  LEN: (args) => `LENGTH(${args[0] || "''"})`,
  LEFT: (args) => `LEFT(${args[0] || "''"}, ${args[1] || 0})`,
  RIGHT: (args) => `RIGHT(${args[0] || "''"}, ${args[1] || 0})`,
  SUBSTR: (args) => args.length >= 3
    ? `SUBSTRING(${args[0]} FROM ${args[1]} FOR ${args[2]})`
    : `SUBSTRING(${args[0] || "''"} FROM ${args[1] || 1})`,
  MID: (args) => args.length >= 3
    ? `SUBSTRING(${args[0]} FROM ${args[1]} FOR ${args[2]})`
    : `SUBSTRING(${args[0] || "''"} FROM ${args[1] || 1})`,
  REPLACE: (args) => `REPLACE(${args[0] || "''"}, ${args[1] || "''"}, ${args[2] || "''"})`,
  REPEAT: (args) => `REPEAT(${args[0] || "''"}, ${args[1] || 1})`,
  REVERSE: (args) => `REVERSE(${args[0] || "''"})`,
  SEARCH: (args) => `POSITION(${args[1] || "''"} IN ${args[0] || "''"})`,
  REGEX_MATCH: (args) => `(${args[0]} ~ ${args[1]})`,
  REGEX_EXTRACT: (args) => `SUBSTRING(${args[0]} FROM ${args[1]})`,
  REGEX_REPLACE: (args) => `REGEXP_REPLACE(${args[0]}, ${args[1]}, ${args[2] || "''"}, 'g')`,

  // ==========================================================================
  // Date/Time Functions
  // ==========================================================================

  NOW: () => 'NOW()',
  TODAY: () => 'CURRENT_DATE',
  CURRENT_DATE: () => 'CURRENT_DATE',
  CURRENT_TIMESTAMP: () => 'CURRENT_TIMESTAMP',
  YEAR: (args) => `EXTRACT(YEAR FROM ${args[0]})::INTEGER`,
  MONTH: (args) => `EXTRACT(MONTH FROM ${args[0]})::INTEGER`,
  DAY: (args) => `EXTRACT(DAY FROM ${args[0]})::INTEGER`,
  HOUR: (args) => `EXTRACT(HOUR FROM ${args[0]})::INTEGER`,
  MINUTE: (args) => `EXTRACT(MINUTE FROM ${args[0]})::INTEGER`,
  SECOND: (args) => `EXTRACT(SECOND FROM ${args[0]})::INTEGER`,
  WEEKDAY: (args) => `EXTRACT(DOW FROM ${args[0]})::INTEGER`,
  WEEKNUM: (args) => `EXTRACT(WEEK FROM ${args[0]})::INTEGER`,
  DATEADD: (args) => `(${args[2]}::TIMESTAMP + INTERVAL '${args[1]} ${args[0]}')`,
  DATEDIFF: (args) => `EXTRACT(${args[0]} FROM (${args[2]}::TIMESTAMP - ${args[1]}::TIMESTAMP))`,
  DATETIME_DIFF: (args) => `EXTRACT(${args[2] || 'DAY'} FROM (${args[1]}::TIMESTAMP - ${args[0]}::TIMESTAMP))`,
  DATE_FORMAT: (args) => `TO_CHAR(${args[0]}::TIMESTAMP, ${args[1]})`,
  DATESTR: (args) => `TO_CHAR(${args[0]}::DATE, 'YYYY-MM-DD')`,
  DATETIME_PARSE: (args) => `TO_TIMESTAMP(${args[0]}, ${args[1] || "'YYYY-MM-DD HH24:MI:SS'"})`,
  LAST_DAY: (args) => `(DATE_TRUNC('MONTH', ${args[0]}::DATE) + INTERVAL '1 MONTH - 1 DAY')::DATE`,
  IS_BEFORE: (args) => `(${args[0]}::TIMESTAMP < ${args[1]}::TIMESTAMP)`,
  IS_AFTER: (args) => `(${args[0]}::TIMESTAMP > ${args[1]}::TIMESTAMP)`,
  IS_SAME: (args) => `DATE_TRUNC(${args[2] || 'DAY'}, ${args[0]}::TIMESTAMP) = DATE_TRUNC(${args[2] || 'DAY'}, ${args[1]}::TIMESTAMP)`,

  // ==========================================================================
  // Math Functions
  // ==========================================================================

  ABS: (args) => `ABS(${args[0]})`,
  CEIL: (args) => `CEIL(${args[0]})`,
  CEILING: (args) => `CEIL(${args[0]})`,
  FLOOR: (args) => `FLOOR(${args[0]})`,
  ROUND: (args) => args.length >= 2
    ? `ROUND(${args[0]}::NUMERIC, ${args[1]})`
    : `ROUND(${args[0]}::NUMERIC)`,
  ROUNDUP: (args) => {
    const precision = args[1] || 0;
    return `CEIL(${args[0]} * POWER(10, ${precision})) / POWER(10, ${precision})`;
  },
  ROUNDDOWN: (args) => {
    const precision = args[1] || 0;
    return `FLOOR(${args[0]} * POWER(10, ${precision})) / POWER(10, ${precision})`;
  },
  MOD: (args) => `MOD(${args[0]}, ${args[1]})`,
  POWER: (args) => `POWER(${args[0]}, ${args[1]})`,
  SQRT: (args) => `SQRT(${args[0]})`,
  EXP: (args) => `EXP(${args[0]})`,
  LOG: (args) => args.length >= 2 ? `LOG(${args[1]}, ${args[0]})` : `LN(${args[0]})`,
  LOG10: (args) => `LOG(10, ${args[0]})`,
  LOG2: (args) => `LOG(2, ${args[0]})`,
  LN: (args) => `LN(${args[0]})`,
  MIN: (args) => `LEAST(${args.join(', ')})`,
  MAX: (args) => `GREATEST(${args.join(', ')})`,
  VALUE: (args) => `(${args[0]})::NUMERIC`,
  INT: (args) => `(${args[0]})::INTEGER`,
  EVEN: (args) => `CEIL(${args[0]} / 2.0) * 2`,
  ODD: (args) => `CEIL((${args[0]} - 1) / 2.0) * 2 + 1`,

  // ==========================================================================
  // Aggregate Functions
  // ==========================================================================

  COUNT: (args) => args.length === 0 || args[0] === '*' ? 'COUNT(*)' : `COUNT(${args[0]})`,
  COUNTA: (args) => `COUNT(${args[0]})`,
  COUNTALL: () => 'COUNT(*)',
  SUM: (args) => `SUM(${args[0]})`,
  AVG: (args) => `AVG(${args[0]})`,
  AVERAGE: (args) => `AVG(${args[0]})`,

  // ==========================================================================
  // JSONB Functions
  // ==========================================================================

  JSON_EXTRACT: (args) => `${args[0]}->>'${args[1]}'`,
  JSON_EXTRACT_PATH: (args) => `${args[0]}#>>'{${args.slice(1).join(',')}}'`,
  JSON_SET: (args) => `jsonb_set(${args[0]}::jsonb, '{${args[1]}}', '${args[2]}'::jsonb)`,
  JSON_CONTAINS: (args) => `(${args[0]}::jsonb @> '${args[1]}'::jsonb)`,
  JSON_OBJECT_KEYS: (args) => `jsonb_object_keys(${args[0]}::jsonb)`,
  JSON_ARRAY_LENGTH: (args) => `jsonb_array_length(${args[0]}::jsonb)`,

  // ==========================================================================
  // Array Functions
  // ==========================================================================

  ARRAY_AGG: (args) => `ARRAY_AGG(${args[0]})`,
  ARRAY_JOIN: (args) => `ARRAY_TO_STRING(${args[0]}, ${args[1] || "','"})`,
  ARRAY_UNIQUE: (args) => `ARRAY(SELECT DISTINCT UNNEST(${args[0]}))`,
  ARRAY_FLATTEN: (args) => `UNNEST(${args[0]})`,
  ARRAY_COMPACT: (args) => `ARRAY(SELECT x FROM UNNEST(${args[0]}) x WHERE x IS NOT NULL)`,
  ARRAY_SLICE: (args) => `${args[0]}[${args[1]}:${args[2]}]`,
};
