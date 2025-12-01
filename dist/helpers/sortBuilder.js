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
exports.sortV2 = sortV2;
exports.parseSortString = parseSortString;
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("./queryBuilderHelper");
// ========================================
// Main Sort Builder
// ========================================
/**
 * Apply sort to query builder (V2)
 * @param sortArr - Array of sorts
 * @param qb - Query builder
 * @param model - Current model
 * @param models - All models
 * @param dbDriver - Database driver
 * @param modelAlias - Optional table alias
 */
async function sortV2(sortArr, qb, model, models, dbDriver, modelAlias) {
    if (!sortArr || sortArr.length === 0) {
        return;
    }
    for (const sort of sortArr) {
        if (!sort.fk_column_id) {
            continue;
        }
        const column = (0, queryBuilderHelper_1.getColumnById)(sort.fk_column_id, model);
        if (!column) {
            continue;
        }
        const direction = sort.direction?.toLowerCase() === 'desc' ? 'desc' : 'asc';
        // Handle virtual columns
        if ((0, queryBuilderHelper_1.isVirtualColumn)(column)) {
            await applyVirtualColumnSort(qb, column, model, models, dbDriver, direction);
        }
        else {
            // Handle regular columns
            applyRegularColumnSort(qb, column, model, dbDriver, direction, modelAlias);
        }
    }
}
// ========================================
// Regular Column Sort
// ========================================
function applyRegularColumnSort(qb, column, model, dbDriver, direction, modelAlias) {
    const sqlColumn = (0, queryBuilderHelper_1.getSqlColumnNameWithCast)(column, model, modelAlias);
    // Handle null sorting (nulls last for asc, nulls first for desc)
    if (direction === 'asc') {
        qb.orderByRaw(`${sqlColumn} ASC NULLS LAST`);
    }
    else {
        qb.orderByRaw(`${sqlColumn} DESC NULLS FIRST`);
    }
}
// ========================================
// Virtual Column Sort
// ========================================
async function applyVirtualColumnSort(qb, column, model, models, dbDriver, direction) {
    switch (column.uidt) {
        case types_1.UITypes.Formula:
            await applyFormulaSort(qb, column, model, models, dbDriver, direction);
            break;
        case types_1.UITypes.Rollup:
            await applyRollupSort(qb, column, model, models, dbDriver, direction);
            break;
        case types_1.UITypes.Lookup:
            await applyLookupSort(qb, column, model, models, dbDriver, direction);
            break;
        case types_1.UITypes.LinkToAnotherRecord:
        case types_1.UITypes.Links:
            await applyLinkSort(qb, column, model, models, dbDriver, direction);
            break;
        default:
            // For other virtual columns, skip sorting
            break;
    }
}
/**
 * Apply formula column sort
 */
async function applyFormulaSort(qb, column, model, models, dbDriver, direction) {
    const options = column.colOptions;
    if (!options?.formula) {
        return;
    }
    const { formulaQueryBuilderV2 } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/formulaQueryBuilderV2')));
    const formulaExpr = await formulaQueryBuilderV2(options.formula, model, models, dbDriver);
    if (direction === 'asc') {
        qb.orderByRaw(`(${formulaExpr}) ASC NULLS LAST`);
    }
    else {
        qb.orderByRaw(`(${formulaExpr}) DESC NULLS FIRST`);
    }
}
/**
 * Apply rollup column sort
 */
async function applyRollupSort(qb, column, model, models, dbDriver, direction) {
    const options = column.colOptions;
    if (!options?.fk_relation_column_id || !options?.fk_rollup_column_id) {
        return;
    }
    const { genRollupSelectV2 } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/genRollupSelectV2')));
    const rollupSubQuery = await genRollupSelectV2({
        column,
        model,
        models,
        dbDriver,
    });
    if (direction === 'asc') {
        qb.orderByRaw(`(${rollupSubQuery.toQuery()}) ASC NULLS LAST`);
    }
    else {
        qb.orderByRaw(`(${rollupSubQuery.toQuery()}) DESC NULLS FIRST`);
    }
}
/**
 * Apply lookup column sort
 */
async function applyLookupSort(qb, column, model, models, dbDriver, direction) {
    const options = column.colOptions;
    if (!options?.fk_relation_column_id || !options?.fk_lookup_column_id) {
        return;
    }
    // Get relation column
    const relationColumn = (0, queryBuilderHelper_1.getColumnById)(options.fk_relation_column_id, model);
    if (!relationColumn) {
        return;
    }
    const relationOptions = relationColumn.colOptions;
    if (!relationOptions?.fk_related_model_id) {
        return;
    }
    // Get related table and lookup column
    const relatedTable = (0, queryBuilderHelper_1.getTableByIdMust)(relationOptions.fk_related_model_id, models);
    const lookupColumn = (0, queryBuilderHelper_1.getColumnById)(options.fk_lookup_column_id, relatedTable);
    if (!lookupColumn) {
        return;
    }
    // Build subquery for sorting
    const lookupSqlCol = (0, queryBuilderHelper_1.getSqlColumnName)(lookupColumn, relatedTable, 'sort_lookup');
    const subQuery = (0, queryBuilderHelper_1.getQueryBuilder)(dbDriver, relatedTable, 'sort_lookup')
        .select(dbDriver.raw(lookupSqlCol))
        .whereRaw(`sort_lookup.id = nc_bigtable.data ->> ?`, [relationColumn.column_name])
        .limit(1);
    if (direction === 'asc') {
        qb.orderByRaw(`(${subQuery.toQuery()}) ASC NULLS LAST`);
    }
    else {
        qb.orderByRaw(`(${subQuery.toQuery()}) DESC NULLS FIRST`);
    }
}
/**
 * Apply link column sort (sort by link count)
 */
async function applyLinkSort(qb, column, model, models, dbDriver, direction) {
    const options = column.colOptions;
    if (!options) {
        return;
    }
    const { genLinkCountToSelect } = await Promise.resolve().then(() => __importStar(require('../queryBuilder/genLinkCountToSelect')));
    const countSubQuery = genLinkCountToSelect({
        modelId: model.id,
        column,
        models,
        dbDriver,
    });
    if (direction === 'asc') {
        qb.orderByRaw(`(${countSubQuery.toQuery()}) ASC NULLS LAST`);
    }
    else {
        qb.orderByRaw(`(${countSubQuery.toQuery()}) DESC NULLS FIRST`);
    }
}
// ========================================
// Sort String Parser
// ========================================
/**
 * Parse sort string into SortType array
 * Format: "+field" or "-field" or "field:asc" or "field:desc"
 */
function parseSortString(sortStr, model) {
    if (!sortStr) {
        return [];
    }
    const sorts = [];
    const columns = model.columns || [];
    const parts = sortStr.split(',');
    for (const part of parts) {
        let fieldName = part.trim();
        let direction = 'asc';
        // Handle +/- prefix
        if (fieldName.startsWith('-')) {
            direction = 'desc';
            fieldName = fieldName.slice(1);
        }
        else if (fieldName.startsWith('+')) {
            direction = 'asc';
            fieldName = fieldName.slice(1);
        }
        // Handle :asc/:desc suffix
        if (fieldName.includes(':')) {
            const [name, dir] = fieldName.split(':');
            fieldName = name;
            direction = dir?.toLowerCase() === 'desc' ? 'desc' : 'asc';
        }
        // Find column
        const column = columns.find((c) => c.column_name === fieldName || c.title === fieldName);
        if (column) {
            sorts.push({
                fk_column_id: column.id,
                direction,
            });
        }
    }
    return sorts;
}
//# sourceMappingURL=sortBuilder.js.map