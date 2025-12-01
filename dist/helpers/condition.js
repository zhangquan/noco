"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.conditionV2 = conditionV2;
exports.parseWhereString = parseWhereString;
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("./queryBuilderHelper");
// ========================================
// Main Condition Builder
// ========================================
/**
 * Apply filter conditions to query builder (V2)
 * @param conditionObj - Filter or array of filters
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 */
async function conditionV2(conditionObj, qb, model, models, dbDriver) {
    const conditions = Array.isArray(conditionObj) ? conditionObj : [conditionObj];
    if (conditions.length === 0) {
        return;
    }
    const conditionFn = await parseConditionV2(conditions, model, models, dbDriver);
    conditionFn(qb);
}
/**
 * Parse conditions into a condition builder function
 */
async function parseConditionV2(conditions, model, models, dbDriver) {
    const builders = [];
    let logicalOp = 'and';
    for (const condition of conditions) {
        // Handle group conditions (nested)
        if (condition.is_group && condition.children) {
            const childBuilder = await parseConditionV2(condition.children, model, models, dbDriver);
            builders.push((qb) => {
                qb.where(function () {
                    childBuilder(this);
                });
            });
            logicalOp = condition.logical_op || 'and';
            continue;
        }
        // Handle leaf conditions
        if (condition.fk_column_id && condition.comparison_op) {
            const builder = await parseLeafCondition(condition, model, models, dbDriver);
            if (builder) {
                builders.push(builder);
            }
            logicalOp = condition.logical_op || 'and';
        }
    }
    // Combine all builders with logical operator
    return (qb) => {
        for (let i = 0; i < builders.length; i++) {
            const builder = builders[i];
            if (i === 0) {
                builder(qb);
            }
            else {
                if (logicalOp === 'or') {
                    qb.orWhere(function () {
                        builder(this);
                    });
                }
                else {
                    qb.andWhere(function () {
                        builder(this);
                    });
                }
            }
        }
    };
}
/**
 * Parse a single leaf condition
 */
async function parseLeafCondition(filter, model, models, dbDriver) {
    const column = (0, queryBuilderHelper_1.getColumnById)(filter.fk_column_id, model);
    if (!column) {
        return null;
    }
    // Handle virtual columns
    if ((0, queryBuilderHelper_1.isVirtualColumn)(column)) {
        return parseVirtualColumnCondition(filter, column, model, models, dbDriver);
    }
    // Handle regular columns
    return parseRegularColumnCondition(filter, column, model, dbDriver);
}
// ========================================
// Regular Column Conditions
// ========================================
function parseRegularColumnCondition(filter, column, model, dbDriver) {
    const sqlColumn = (0, queryBuilderHelper_1.getSqlColumnNameWithCast)(column, model);
    const op = filter.comparison_op;
    const value = filter.value;
    return (qb) => {
        applyComparisonOperator(qb, dbDriver, sqlColumn, op, value, column);
    };
}
/**
 * Apply comparison operator to query builder
 */
function applyComparisonOperator(qb, dbDriver, columnExpr, op, value, column) {
    switch (op) {
        case 'eq':
            qb.whereRaw(`${columnExpr} = ?`, [value]);
            break;
        case 'neq':
            qb.whereRaw(`${columnExpr} != ?`, [value]);
            break;
        case 'lt':
            qb.whereRaw(`${columnExpr} < ?`, [value]);
            break;
        case 'lte':
            qb.whereRaw(`${columnExpr} <= ?`, [value]);
            break;
        case 'gt':
            qb.whereRaw(`${columnExpr} > ?`, [value]);
            break;
        case 'gte':
            qb.whereRaw(`${columnExpr} >= ?`, [value]);
            break;
        case 'like':
            qb.whereRaw(`${columnExpr} ILIKE ?`, [`%${value}%`]);
            break;
        case 'nlike':
            qb.whereRaw(`${columnExpr} NOT ILIKE ?`, [`%${value}%`]);
            break;
        case 'null':
        case 'is':
            qb.whereRaw(`${columnExpr} IS NULL`);
            break;
        case 'notnull':
        case 'isnot':
            qb.whereRaw(`${columnExpr} IS NOT NULL`);
            break;
        case 'empty':
            qb.where(function () {
                this.whereRaw(`${columnExpr} IS NULL`)
                    .orWhereRaw(`${columnExpr} = ''`);
            });
            break;
        case 'notempty':
            qb.whereRaw(`${columnExpr} IS NOT NULL`)
                .whereRaw(`${columnExpr} != ''`);
            break;
        case 'in':
            const inValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
            qb.whereRaw(`${columnExpr} = ANY(?)`, [inValues]);
            break;
        case 'notin':
            const notInValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
            qb.whereRaw(`${columnExpr} != ALL(?)`, [notInValues]);
            break;
        case 'between':
            if (Array.isArray(value) && value.length >= 2) {
                qb.whereRaw(`${columnExpr} BETWEEN ? AND ?`, [value[0], value[1]]);
            }
            break;
        case 'notbetween':
            if (Array.isArray(value) && value.length >= 2) {
                qb.whereRaw(`${columnExpr} NOT BETWEEN ? AND ?`, [value[0], value[1]]);
            }
            break;
        case 'allof':
            // For MultiSelect: all values must be present
            if (column.uidt === types_1.UITypes.MultiSelect) {
                const allValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
                for (const v of allValues) {
                    qb.whereRaw(`${columnExpr}::jsonb ? ?`, [v]);
                }
            }
            break;
        case 'anyof':
            // For MultiSelect: any value must be present
            if (column.uidt === types_1.UITypes.MultiSelect) {
                const anyValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
                qb.where(function () {
                    for (const v of anyValues) {
                        this.orWhereRaw(`${columnExpr}::jsonb ? ?`, [v]);
                    }
                });
            }
            break;
        case 'nallof':
            // For MultiSelect: not all values present
            if (column.uidt === types_1.UITypes.MultiSelect) {
                const nallValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
                qb.where(function () {
                    for (const v of nallValues) {
                        this.orWhereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
                    }
                });
            }
            break;
        case 'nanyof':
            // For MultiSelect: none of the values present
            if (column.uidt === types_1.UITypes.MultiSelect) {
                const nanyValues = Array.isArray(value) ? value : String(value).split(',').map(v => v.trim());
                for (const v of nanyValues) {
                    qb.whereRaw(`NOT (${columnExpr}::jsonb ? ?)`, [v]);
                }
            }
            break;
        default:
            // Default to equality
            qb.whereRaw(`${columnExpr} = ?`, [value]);
    }
}
// ========================================
// Virtual Column Conditions
// ========================================
async function parseVirtualColumnCondition(filter, column, model, models, dbDriver) {
    switch (column.uidt) {
        case types_1.UITypes.Formula:
            return parseFormulaCondition(filter, column, model, models, dbDriver);
        case types_1.UITypes.Rollup:
            return parseRollupCondition(filter, column, model, models, dbDriver);
        case types_1.UITypes.Lookup:
            return parseLookupCondition(filter, column, model, models, dbDriver);
        case types_1.UITypes.LinkToAnotherRecord:
        case types_1.UITypes.Links:
            return parseLinkCondition(filter, column, model, models, dbDriver);
        default:
            return () => { };
    }
}
/**
 * Parse formula column condition
 */
async function parseFormulaCondition(filter, column, model, models, dbDriver) {
    const options = column.colOptions;
    if (!options?.formula) {
        return () => { };
    }
    // Import formula builder dynamically to avoid circular dependency
    const { formulaQueryBuilderV2 } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/formulaQueryBuilderV2')));
    const formulaExpr = await formulaQueryBuilderV2(options.formula, model, models, dbDriver);
    return (qb) => {
        applyComparisonOperator(qb, dbDriver, `(${formulaExpr})`, filter.comparison_op, filter.value, column);
    };
}
/**
 * Parse rollup column condition
 */
async function parseRollupCondition(filter, column, model, models, dbDriver) {
    const options = column.colOptions;
    if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
        return () => { };
    }
    // Import rollup builder dynamically
    const { genRollupSelectV2 } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/genRollupSelectV2')));
    const rollupSubQuery = await genRollupSelectV2({
        column,
        model,
        models,
        dbDriver,
    });
    return (qb) => {
        applyComparisonOperator(qb, dbDriver, `(${rollupSubQuery.toQuery()})`, filter.comparison_op, filter.value, column);
    };
}
/**
 * Parse lookup column condition
 */
async function parseLookupCondition(filter, column, model, models, dbDriver) {
    const options = column.colOptions;
    if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
        return () => { };
    }
    // Get relation column
    const relationColumn = (0, queryBuilderHelper_1.getColumnById)(options.fk_relation_column_id, model);
    if (!relationColumn) {
        return () => { };
    }
    const relationOptions = relationColumn.colOptions;
    if (!relationOptions?.fk_related_model_id) {
        return () => { };
    }
    // Get related table and lookup column
    const relatedTable = (0, queryBuilderHelper_1.getTableByIdMust)(relationOptions.fk_related_model_id, models);
    const lookupColumn = (0, queryBuilderHelper_1.getColumnById)(options.fk_lookup_column_id, relatedTable);
    if (!lookupColumn) {
        return () => { };
    }
    // Build subquery
    const lookupSqlCol = (0, queryBuilderHelper_1.getSqlColumnName)(lookupColumn, relatedTable, 'lookup_table');
    return (qb) => {
        const subQuery = (0, queryBuilderHelper_1.getQueryBuilder)(dbDriver, relatedTable, 'lookup_table')
            .select(dbDriver.raw(lookupSqlCol))
            .whereRaw(`lookup_table.id = nc_bigtable.data ->> ?`, [relationColumn.column_name]);
        applyComparisonOperator(qb, dbDriver, `(${subQuery.toQuery()})`, filter.comparison_op, filter.value, column);
    };
}
/**
 * Parse link column condition (filter by link count)
 */
async function parseLinkCondition(filter, column, model, models, dbDriver) {
    const options = column.colOptions;
    if (!options) {
        return () => { };
    }
    // Import link count builder dynamically
    const { genLinkCountToSelect } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/genLinkCountToSelect')));
    const countSubQuery = genLinkCountToSelect({
        modelId: model.id,
        column,
        models,
        dbDriver,
    });
    return (qb) => {
        applyComparisonOperator(qb, dbDriver, `(${countSubQuery.toQuery()})`, filter.comparison_op, filter.value, column);
    };
}
// ========================================
// Legacy Condition Support
// ========================================
/**
 * Parse simple where string (legacy format)
 * Format: "field,op,value" or "(field,op,value)~and(field,op,value)"
 */
function parseWhereString(whereStr, model) {
    if (!whereStr) {
        return [];
    }
    const filters = [];
    const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(model);
    // Simple parsing - can be enhanced for complex expressions
    const parts = whereStr.split('~');
    for (const part of parts) {
        const match = part.match(/^\(?([\w]+),([\w]+),(.+?)\)?$/);
        if (match) {
            const [, fieldName, op, value] = match;
            const column = columns.find((c) => c.column_name === fieldName || c.title === fieldName);
            if (column) {
                filters.push({
                    fk_column_id: column.id,
                    comparison_op: op,
                    value: value,
                });
            }
        }
    }
    return filters;
}
//# sourceMappingURL=condition.js.map