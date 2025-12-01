"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgFns = void 0;
exports.getFunction = getFunction;
exports.hasFunction = hasFunction;
exports.getFunctionNames = getFunctionNames;
const commonFns_1 = require("./commonFns");
/**
 * PostgreSQL-specific function mappings
 */
exports.pgFns = {
    // Include common functions
    ...commonFns_1.commonFns,
    // ========================================
    // String Functions
    // ========================================
    /**
     * CONCAT(str1, str2, ...)
     */
    CONCAT: (args) => {
        return `CONCAT(${args.join(', ')})`;
    },
    /**
     * CONCAT_WS(separator, str1, str2, ...)
     */
    CONCAT_WS: (args) => {
        return `CONCAT_WS(${args.join(', ')})`;
    },
    /**
     * UPPER(str)
     */
    UPPER: (args) => {
        return `UPPER(${args[0] || "''"})`;
    },
    /**
     * LOWER(str)
     */
    LOWER: (args) => {
        return `LOWER(${args[0] || "''"})`;
    },
    /**
     * TRIM(str)
     */
    TRIM: (args) => {
        return `TRIM(${args[0] || "''"})`;
    },
    /**
     * LTRIM(str)
     */
    LTRIM: (args) => {
        return `LTRIM(${args[0] || "''"})`;
    },
    /**
     * RTRIM(str)
     */
    RTRIM: (args) => {
        return `RTRIM(${args[0] || "''"})`;
    },
    /**
     * LENGTH(str)
     */
    LENGTH: (args) => {
        return `LENGTH(${args[0] || "''"})`;
    },
    /**
     * LEN(str) - alias for LENGTH
     */
    LEN: (args) => {
        return `LENGTH(${args[0] || "''"})`;
    },
    /**
     * LEFT(str, n)
     */
    LEFT: (args) => {
        return `LEFT(${args[0] || "''"}, ${args[1] || 0})`;
    },
    /**
     * RIGHT(str, n)
     */
    RIGHT: (args) => {
        return `RIGHT(${args[0] || "''"}, ${args[1] || 0})`;
    },
    /**
     * SUBSTR(str, start, length) or SUBSTRING
     */
    SUBSTR: (args) => {
        if (args.length >= 3) {
            return `SUBSTRING(${args[0]} FROM ${args[1]} FOR ${args[2]})`;
        }
        return `SUBSTRING(${args[0] || "''"} FROM ${args[1] || 1})`;
    },
    /**
     * MID(str, start, length) - alias for SUBSTR
     */
    MID: (args) => {
        if (args.length >= 3) {
            return `SUBSTRING(${args[0]} FROM ${args[1]} FOR ${args[2]})`;
        }
        return `SUBSTRING(${args[0] || "''"} FROM ${args[1] || 1})`;
    },
    /**
     * REPLACE(str, from, to)
     */
    REPLACE: (args) => {
        return `REPLACE(${args[0] || "''"}, ${args[1] || "''"}, ${args[2] || "''"})`;
    },
    /**
     * REPEAT(str, n)
     */
    REPEAT: (args) => {
        return `REPEAT(${args[0] || "''"}, ${args[1] || 1})`;
    },
    /**
     * REVERSE(str)
     */
    REVERSE: (args) => {
        return `REVERSE(${args[0] || "''"})`;
    },
    /**
     * POSITION(substr IN str) / INSTR
     */
    SEARCH: (args) => {
        return `POSITION(${args[1] || "''"} IN ${args[0] || "''"})`;
    },
    /**
     * REGEX_MATCH(str, pattern) - PostgreSQL regex
     */
    REGEX_MATCH: (args) => {
        return `(${args[0]} ~ ${args[1]})`;
    },
    /**
     * REGEX_EXTRACT(str, pattern)
     */
    REGEX_EXTRACT: (args) => {
        return `SUBSTRING(${args[0]} FROM ${args[1]})`;
    },
    /**
     * REGEX_REPLACE(str, pattern, replacement)
     */
    REGEX_REPLACE: (args) => {
        return `REGEXP_REPLACE(${args[0]}, ${args[1]}, ${args[2] || "''"}, 'g')`;
    },
    // ========================================
    // Date/Time Functions
    // ========================================
    /**
     * NOW()
     */
    NOW: () => 'NOW()',
    /**
     * TODAY()
     */
    TODAY: () => 'CURRENT_DATE',
    /**
     * CURRENT_DATE()
     */
    CURRENT_DATE: () => 'CURRENT_DATE',
    /**
     * CURRENT_TIMESTAMP()
     */
    CURRENT_TIMESTAMP: () => 'CURRENT_TIMESTAMP',
    /**
     * YEAR(date)
     */
    YEAR: (args) => {
        return `EXTRACT(YEAR FROM ${args[0]})::INTEGER`;
    },
    /**
     * MONTH(date)
     */
    MONTH: (args) => {
        return `EXTRACT(MONTH FROM ${args[0]})::INTEGER`;
    },
    /**
     * DAY(date)
     */
    DAY: (args) => {
        return `EXTRACT(DAY FROM ${args[0]})::INTEGER`;
    },
    /**
     * HOUR(datetime)
     */
    HOUR: (args) => {
        return `EXTRACT(HOUR FROM ${args[0]})::INTEGER`;
    },
    /**
     * MINUTE(datetime)
     */
    MINUTE: (args) => {
        return `EXTRACT(MINUTE FROM ${args[0]})::INTEGER`;
    },
    /**
     * SECOND(datetime)
     */
    SECOND: (args) => {
        return `EXTRACT(SECOND FROM ${args[0]})::INTEGER`;
    },
    /**
     * WEEKDAY(date) - returns 0-6 (Sunday-Saturday)
     */
    WEEKDAY: (args) => {
        return `EXTRACT(DOW FROM ${args[0]})::INTEGER`;
    },
    /**
     * WEEKNUM(date) - ISO week number
     */
    WEEKNUM: (args) => {
        return `EXTRACT(WEEK FROM ${args[0]})::INTEGER`;
    },
    /**
     * DATEADD(interval, value, date)
     */
    DATEADD: (args) => {
        const [interval, value, date] = args;
        return `(${date}::TIMESTAMP + INTERVAL '${value} ${interval}')`;
    },
    /**
     * DATEDIFF(unit, date1, date2)
     */
    DATEDIFF: (args) => {
        const [unit, date1, date2] = args;
        return `EXTRACT(${unit} FROM (${date2}::TIMESTAMP - ${date1}::TIMESTAMP))`;
    },
    /**
     * DATETIME_DIFF(date1, date2, unit)
     */
    DATETIME_DIFF: (args) => {
        const [date1, date2, unit = 'DAY'] = args;
        return `EXTRACT(${unit} FROM (${date2}::TIMESTAMP - ${date1}::TIMESTAMP))`;
    },
    /**
     * DATE_FORMAT(date, format)
     */
    DATE_FORMAT: (args) => {
        return `TO_CHAR(${args[0]}::TIMESTAMP, ${args[1]})`;
    },
    /**
     * DATESTR(date) - convert to ISO date string
     */
    DATESTR: (args) => {
        return `TO_CHAR(${args[0]}::DATE, 'YYYY-MM-DD')`;
    },
    /**
     * DATETIME_PARSE(str, format)
     */
    DATETIME_PARSE: (args) => {
        return `TO_TIMESTAMP(${args[0]}, ${args[1] || "'YYYY-MM-DD HH24:MI:SS'"})`;
    },
    /**
     * LAST_DAY(date) - last day of month
     */
    LAST_DAY: (args) => {
        return `(DATE_TRUNC('MONTH', ${args[0]}::DATE) + INTERVAL '1 MONTH - 1 DAY')::DATE`;
    },
    /**
     * IS_BEFORE(date1, date2)
     */
    IS_BEFORE: (args) => {
        return `(${args[0]}::TIMESTAMP < ${args[1]}::TIMESTAMP)`;
    },
    /**
     * IS_AFTER(date1, date2)
     */
    IS_AFTER: (args) => {
        return `(${args[0]}::TIMESTAMP > ${args[1]}::TIMESTAMP)`;
    },
    /**
     * IS_SAME(date1, date2, unit)
     */
    IS_SAME: (args) => {
        const [date1, date2, unit = 'DAY'] = args;
        return `DATE_TRUNC(${unit}, ${date1}::TIMESTAMP) = DATE_TRUNC(${unit}, ${date2}::TIMESTAMP)`;
    },
    // ========================================
    // Math Functions
    // ========================================
    /**
     * ABS(number)
     */
    ABS: (args) => {
        return `ABS(${args[0]})`;
    },
    /**
     * CEIL(number)
     */
    CEIL: (args) => {
        return `CEIL(${args[0]})`;
    },
    /**
     * CEILING(number) - alias for CEIL
     */
    CEILING: (args) => {
        return `CEIL(${args[0]})`;
    },
    /**
     * FLOOR(number)
     */
    FLOOR: (args) => {
        return `FLOOR(${args[0]})`;
    },
    /**
     * ROUND(number, precision)
     */
    ROUND: (args) => {
        if (args.length >= 2) {
            return `ROUND(${args[0]}::NUMERIC, ${args[1]})`;
        }
        return `ROUND(${args[0]}::NUMERIC)`;
    },
    /**
     * ROUNDUP(number, precision)
     */
    ROUNDUP: (args) => {
        const precision = args[1] || 0;
        return `CEIL(${args[0]} * POWER(10, ${precision})) / POWER(10, ${precision})`;
    },
    /**
     * ROUNDDOWN(number, precision)
     */
    ROUNDDOWN: (args) => {
        const precision = args[1] || 0;
        return `FLOOR(${args[0]} * POWER(10, ${precision})) / POWER(10, ${precision})`;
    },
    /**
     * MOD(dividend, divisor)
     */
    MOD: (args) => {
        return `MOD(${args[0]}, ${args[1]})`;
    },
    /**
     * POWER(base, exponent)
     */
    POWER: (args) => {
        return `POWER(${args[0]}, ${args[1]})`;
    },
    /**
     * SQRT(number)
     */
    SQRT: (args) => {
        return `SQRT(${args[0]})`;
    },
    /**
     * EXP(number)
     */
    EXP: (args) => {
        return `EXP(${args[0]})`;
    },
    /**
     * LOG(number, base)
     */
    LOG: (args) => {
        if (args.length >= 2) {
            return `LOG(${args[1]}, ${args[0]})`;
        }
        return `LN(${args[0]})`;
    },
    /**
     * LOG10(number)
     */
    LOG10: (args) => {
        return `LOG(10, ${args[0]})`;
    },
    /**
     * LOG2(number)
     */
    LOG2: (args) => {
        return `LOG(2, ${args[0]})`;
    },
    /**
     * LN(number)
     */
    LN: (args) => {
        return `LN(${args[0]})`;
    },
    /**
     * MIN(value1, value2, ...)
     */
    MIN: (args) => {
        return `LEAST(${args.join(', ')})`;
    },
    /**
     * MAX(value1, value2, ...)
     */
    MAX: (args) => {
        return `GREATEST(${args.join(', ')})`;
    },
    /**
     * VALUE(str) - convert string to number
     */
    VALUE: (args) => {
        return `(${args[0]})::NUMERIC`;
    },
    /**
     * INT(number) - convert to integer
     */
    INT: (args) => {
        return `(${args[0]})::INTEGER`;
    },
    /**
     * EVEN(number) - round to nearest even
     */
    EVEN: (args) => {
        return `CEIL(${args[0]} / 2.0) * 2`;
    },
    /**
     * ODD(number) - round to nearest odd
     */
    ODD: (args) => {
        return `CEIL((${args[0]} - 1) / 2.0) * 2 + 1`;
    },
    // ========================================
    // Aggregate Functions (for Rollup/Summary)
    // ========================================
    /**
     * COUNT(column)
     */
    COUNT: (args) => {
        if (args.length === 0 || args[0] === '*') {
            return 'COUNT(*)';
        }
        return `COUNT(${args[0]})`;
    },
    /**
     * COUNTA(column) - count non-empty
     */
    COUNTA: (args) => {
        return `COUNT(${args[0]})`;
    },
    /**
     * COUNTALL() - count all rows
     */
    COUNTALL: () => {
        return 'COUNT(*)';
    },
    /**
     * SUM(column)
     */
    SUM: (args) => {
        return `SUM(${args[0]})`;
    },
    /**
     * AVG(column)
     */
    AVG: (args) => {
        return `AVG(${args[0]})`;
    },
    /**
     * AVERAGE(column) - alias for AVG
     */
    AVERAGE: (args) => {
        return `AVG(${args[0]})`;
    },
    // ========================================
    // JSONB Functions (PostgreSQL specific)
    // ========================================
    /**
     * JSON_EXTRACT(json, path)
     */
    JSON_EXTRACT: (args) => {
        return `${args[0]}->>'${args[1]}'`;
    },
    /**
     * JSON_EXTRACT_PATH(json, path)
     */
    JSON_EXTRACT_PATH: (args) => {
        const paths = args.slice(1);
        return `${args[0]}#>>'{${paths.join(',')}}'`;
    },
    /**
     * JSON_SET(json, path, value)
     */
    JSON_SET: (args) => {
        return `jsonb_set(${args[0]}::jsonb, '{${args[1]}}', '${args[2]}'::jsonb)`;
    },
    /**
     * JSON_CONTAINS(json, value)
     */
    JSON_CONTAINS: (args) => {
        return `(${args[0]}::jsonb @> '${args[1]}'::jsonb)`;
    },
    /**
     * JSON_OBJECT_KEYS(json)
     */
    JSON_OBJECT_KEYS: (args) => {
        return `jsonb_object_keys(${args[0]}::jsonb)`;
    },
    /**
     * JSON_ARRAY_LENGTH(json)
     */
    JSON_ARRAY_LENGTH: (args) => {
        return `jsonb_array_length(${args[0]}::jsonb)`;
    },
    // ========================================
    // Array Functions
    // ========================================
    /**
     * ARRAY_AGG(column)
     */
    ARRAY_AGG: (args) => {
        return `ARRAY_AGG(${args[0]})`;
    },
    /**
     * ARRAY_JOIN(array, separator)
     */
    ARRAY_JOIN: (args) => {
        return `ARRAY_TO_STRING(${args[0]}, ${args[1] || "','"})`;
    },
    /**
     * ARRAY_UNIQUE(array)
     */
    ARRAY_UNIQUE: (args) => {
        return `ARRAY(SELECT DISTINCT UNNEST(${args[0]}))`;
    },
    /**
     * ARRAY_FLATTEN(array)
     */
    ARRAY_FLATTEN: (args) => {
        return `UNNEST(${args[0]})`;
    },
    /**
     * ARRAY_COMPACT(array) - remove nulls
     */
    ARRAY_COMPACT: (args) => {
        return `ARRAY(SELECT x FROM UNNEST(${args[0]}) x WHERE x IS NOT NULL)`;
    },
    /**
     * ARRAY_SLICE(array, start, end)
     */
    ARRAY_SLICE: (args) => {
        return `${args[0]}[${args[1]}:${args[2]}]`;
    },
};
/**
 * Get function by name (case-insensitive)
 */
function getFunction(name) {
    const upperName = name.toUpperCase();
    return exports.pgFns[upperName];
}
/**
 * Check if a function exists
 */
function hasFunction(name) {
    return getFunction(name) !== undefined;
}
/**
 * Get all available function names
 */
function getFunctionNames() {
    return Object.keys(exports.pgFns);
}
//# sourceMappingURL=pg.js.map