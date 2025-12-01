"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonFns = void 0;
/**
 * Common logical and utility functions
 * These are database-agnostic and work with standard SQL
 */
exports.commonFns = {
    // ========================================
    // Logical Functions
    // ========================================
    /**
     * IF(condition, true_value, false_value)
     */
    IF: (args) => {
        if (args.length < 3) {
            return `CASE WHEN ${args[0] || 'NULL'} THEN ${args[1] || 'NULL'} ELSE NULL END`;
        }
        return `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`;
    },
    /**
     * SWITCH(expr, case1, value1, case2, value2, ..., default)
     */
    SWITCH: (args) => {
        if (args.length < 2) {
            return 'NULL';
        }
        const expr = args[0];
        const cases = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            cases.push(`WHEN ${args[i]} THEN ${args[i + 1]}`);
        }
        const defaultValue = args.length % 2 === 0 ? args[args.length - 1] : 'NULL';
        return `CASE ${expr} ${cases.join(' ')} ELSE ${defaultValue} END`;
    },
    /**
     * AND(condition1, condition2, ...)
     */
    AND: (args) => {
        if (args.length === 0)
            return 'TRUE';
        return `(${args.join(' AND ')})`;
    },
    /**
     * OR(condition1, condition2, ...)
     */
    OR: (args) => {
        if (args.length === 0)
            return 'FALSE';
        return `(${args.join(' OR ')})`;
    },
    /**
     * NOT(condition)
     */
    NOT: (args) => {
        return `NOT (${args[0] || 'NULL'})`;
    },
    /**
     * TRUE constant
     */
    TRUE: () => 'TRUE',
    /**
     * FALSE constant
     */
    FALSE: () => 'FALSE',
    // ========================================
    // Comparison Functions
    // ========================================
    /**
     * ISBLANK(value)
     */
    ISBLANK: (args) => {
        return `(${args[0]} IS NULL OR ${args[0]} = '')`;
    },
    /**
     * ISERROR(value) - always returns false in SQL context
     */
    ISERROR: () => 'FALSE',
    /**
     * ISNULL(value)
     */
    ISNULL: (args) => {
        return `(${args[0]} IS NULL)`;
    },
    /**
     * COALESCE(value1, value2, ...)
     */
    COALESCE: (args) => {
        return `COALESCE(${args.join(', ')})`;
    },
    /**
     * NULLIF(value1, value2)
     */
    NULLIF: (args) => {
        return `NULLIF(${args[0] || 'NULL'}, ${args[1] || 'NULL'})`;
    },
    // ========================================
    // Comparison Operators
    // ========================================
    /**
     * EQUAL(value1, value2)
     */
    EQUAL: (args) => {
        return `(${args[0]} = ${args[1]})`;
    },
    /**
     * GREATER(value1, value2)
     */
    GREATER: (args) => {
        return `(${args[0]} > ${args[1]})`;
    },
    /**
     * LESS(value1, value2)
     */
    LESS: (args) => {
        return `(${args[0]} < ${args[1]})`;
    },
    /**
     * GREATEREQUAL(value1, value2)
     */
    GREATEREQUAL: (args) => {
        return `(${args[0]} >= ${args[1]})`;
    },
    /**
     * LESSEQUAL(value1, value2)
     */
    LESSEQUAL: (args) => {
        return `(${args[0]} <= ${args[1]})`;
    },
    // ========================================
    // Utility Functions
    // ========================================
    /**
     * BLANK() - returns empty string
     */
    BLANK: () => "''",
    /**
     * ERROR(message) - returns NULL (no error support in SQL)
     */
    ERROR: () => 'NULL',
    /**
     * RECORD_ID() - returns ID column
     */
    RECORD_ID: () => 'id',
    /**
     * CREATED_TIME() - returns created_at column
     */
    CREATED_TIME: () => 'created_at',
    /**
     * LAST_MODIFIED_TIME() - returns updated_at column
     */
    LAST_MODIFIED_TIME: () => 'updated_at',
    /**
     * CREATED_BY() - returns created_by column
     */
    CREATED_BY: () => 'created_by',
    /**
     * LAST_MODIFIED_BY() - returns updated_by column
     */
    LAST_MODIFIED_BY: () => 'updated_by',
};
//# sourceMappingURL=commonFns.js.map