"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genRollupSelectV2 = genRollupSelectV2;
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
// ========================================
// Main Function
// ========================================
/**
 * Generate subquery for rollup column
 * @param params - Parameters for rollup generation
 * @returns Knex subquery or raw expression
 */
async function genRollupSelectV2(params) {
    const { column, model, models, dbDriver, alias } = params;
    const rollupOptions = column.colOptions;
    if (!rollupOptions) {
        return dbDriver.raw('NULL');
    }
    const { fk_relation_column_id, fk_rollup_column_id, rollup_function = 'count', } = rollupOptions;
    if (!fk_relation_column_id || !fk_rollup_column_id) {
        return dbDriver.raw('NULL');
    }
    // Get the relation column
    const relationColumn = (0, queryBuilderHelper_1.getColumnById)(fk_relation_column_id, model);
    if (!relationColumn) {
        return dbDriver.raw('NULL');
    }
    const relationOptions = relationColumn.colOptions;
    if (!relationOptions) {
        return dbDriver.raw('NULL');
    }
    // Get the related table
    const relatedTableId = relationOptions.fk_related_model_id;
    if (!relatedTableId) {
        return dbDriver.raw('NULL');
    }
    const relatedTable = (0, queryBuilderHelper_1.getTableByIdMust)(relatedTableId, models);
    // Get the rollup column
    const rollupColumn = (0, queryBuilderHelper_1.getColumnById)(fk_rollup_column_id, relatedTable);
    if (!rollupColumn) {
        return dbDriver.raw('NULL');
    }
    const rollupSqlCol = (0, queryBuilderHelper_1.getSqlColumnNameWithCast)(rollupColumn, relatedTable, 'rollup_child');
    // Build subquery based on relation type
    switch (relationOptions.type) {
        case types_1.RelationTypes.MANY_TO_MANY:
            return buildMmRollupSubquery(model, relatedTable, relationOptions, rollupSqlCol, rollup_function, models, dbDriver, alias);
        case types_1.RelationTypes.HAS_MANY:
            return buildHmRollupSubquery(model, relatedTable, relationColumn, rollupSqlCol, rollup_function, dbDriver, alias);
        case types_1.RelationTypes.BELONGS_TO:
            return buildBtRollupSubquery(model, relatedTable, relationColumn, rollupSqlCol, rollup_function, dbDriver, alias);
        default:
            return dbDriver.raw('NULL');
    }
}
// ========================================
// Subquery Builders
// ========================================
/**
 * Build MM (Many-to-Many) rollup subquery
 */
function buildMmRollupSubquery(model, relatedTable, relationOptions, rollupSqlCol, rollupFunction, models, dbDriver, alias) {
    const mmTableId = relationOptions.fk_mm_model_id || relationOptions.mm_model_id;
    if (!mmTableId) {
        return dbDriver.raw('NULL');
    }
    const mmTable = (0, queryBuilderHelper_1.getTableByIdMust)(mmTableId, models);
    const parentAlias = alias || 'nc_bigtable';
    // Subquery to get child IDs from junction table
    const childIdsSubquery = dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS + ' AS mm')
        .select('mm.fk_child_id')
        .where('mm.fk_table_id', mmTable.id)
        .whereRaw(`mm.fk_parent_id = ${parentAlias}.id`);
    // Main subquery with aggregation
    const subquery = dbDriver(queryBuilderHelper_1.NC_BIGTABLE + ' AS rollup_child')
        .select(dbDriver.raw(getRollupAggregation(rollupFunction, rollupSqlCol)))
        .where('rollup_child.fk_table_id', relatedTable.id)
        .whereIn('rollup_child.id', childIdsSubquery);
    return subquery;
}
/**
 * Build HM (Has Many) rollup subquery
 */
function buildHmRollupSubquery(model, relatedTable, relationColumn, rollupSqlCol, rollupFunction, dbDriver, alias) {
    const parentAlias = alias || 'nc_bigtable';
    const relationOptions = relationColumn.colOptions;
    // Get the foreign key column in the child table
    const fkColumnId = relationOptions.fk_child_column_id;
    let fkColumnName = 'fk_parent_id';
    if (fkColumnId) {
        const fkColumn = (0, queryBuilderHelper_1.getColumnById)(fkColumnId, relatedTable);
        if (fkColumn) {
            fkColumnName = fkColumn.column_name;
        }
    }
    // Subquery with aggregation
    const subquery = dbDriver(queryBuilderHelper_1.NC_BIGTABLE + ' AS rollup_child')
        .select(dbDriver.raw(getRollupAggregation(rollupFunction, rollupSqlCol)))
        .where('rollup_child.fk_table_id', relatedTable.id)
        .whereRaw(`rollup_child.data ->> '${fkColumnName}' = ${parentAlias}.id`);
    return subquery;
}
/**
 * Build BT (Belongs To) rollup subquery
 */
function buildBtRollupSubquery(model, relatedTable, relationColumn, rollupSqlCol, rollupFunction, dbDriver, alias) {
    const parentAlias = alias || 'nc_bigtable';
    // Get the FK column in the current model
    const fkColumnName = relationColumn.column_name;
    // Subquery with aggregation
    const subquery = dbDriver(queryBuilderHelper_1.NC_BIGTABLE + ' AS rollup_child')
        .select(dbDriver.raw(getRollupAggregation(rollupFunction, rollupSqlCol)))
        .where('rollup_child.fk_table_id', relatedTable.id)
        .whereRaw(`rollup_child.id = ${parentAlias}.data ->> '${fkColumnName}'`);
    return subquery;
}
// ========================================
// Aggregation Helpers
// ========================================
/**
 * Get SQL aggregation expression for rollup function
 */
function getRollupAggregation(rollupFunction, columnExpr) {
    switch (rollupFunction) {
        case 'count':
            return 'COUNT(*)';
        case 'sum':
            return `COALESCE(SUM(${columnExpr}::NUMERIC), 0)`;
        case 'avg':
            return `AVG(${columnExpr}::NUMERIC)`;
        case 'min':
            return `MIN(${columnExpr})`;
        case 'max':
            return `MAX(${columnExpr})`;
        case 'countEmpty':
            return `COUNT(*) FILTER (WHERE ${columnExpr} IS NULL OR ${columnExpr} = '')`;
        case 'countNotEmpty':
            return `COUNT(*) FILTER (WHERE ${columnExpr} IS NOT NULL AND ${columnExpr} != '')`;
        case 'countDistinct':
            return `COUNT(DISTINCT ${columnExpr})`;
        case 'sumDistinct':
            return `COALESCE(SUM(DISTINCT ${columnExpr}::NUMERIC), 0)`;
        case 'avgDistinct':
            return `AVG(DISTINCT ${columnExpr}::NUMERIC)`;
        default:
            return 'COUNT(*)';
    }
}
//# sourceMappingURL=genRollupSelectV2.js.map