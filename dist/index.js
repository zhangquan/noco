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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseModel = getBaseModel;
exports.getLinkModel = getLinkModel;
exports.getLazyloadModel = getLazyloadModel;
exports.getCopyModel = getCopyModel;
exports.createTables = createTables;
exports.dropTables = dropTables;
const JSONModelSqlImp_1 = require("./impl/JSONModelSqlImp");
const JSONLinkModelSql_1 = require("./impl/JSONLinkModelSql");
const LazyloadLinkModelSql_1 = require("./impl/LazyloadLinkModelSql");
const CopySqlImp_1 = require("./impl/CopySqlImp");
// ========================================
// Re-exports
// ========================================
// Interfaces
__exportStar(require("./interface/types"), exports);
__exportStar(require("./interface/BaseModelSql"), exports);
__exportStar(require("./interface/LinkModelSql"), exports);
__exportStar(require("./interface/NcError"), exports);
// Abstract classes
__exportStar(require("./abstract/AbstractBaseModelSql"), exports);
__exportStar(require("./abstract/AbstractLinkModelSql"), exports);
// Implementations
__exportStar(require("./impl/JSONModelSqlImp"), exports);
__exportStar(require("./impl/JSONLinkModelSql"), exports);
__exportStar(require("./impl/LazyloadLinkModelSql"), exports);
__exportStar(require("./impl/CopySqlImp"), exports);
// Helpers
__exportStar(require("./helpers/sanitize"), exports);
__exportStar(require("./helpers/queryBuilderHelper"), exports);
__exportStar(require("./helpers/condition"), exports);
__exportStar(require("./helpers/sortBuilder"), exports);
// Query builders
__exportStar(require("./queryBuilder/formulaQueryBuilderV2"), exports);
__exportStar(require("./queryBuilder/genRollupSelectV2"), exports);
__exportStar(require("./queryBuilder/genLinkCountToSelect"), exports);
// Function mappings
__exportStar(require("./functionMappings/commonFns"), exports);
__exportStar(require("./functionMappings/pg"), exports);
// ========================================
// Factory Function
// ========================================
/**
 * Get a base model instance
 *
 * @param params - Parameters for model creation
 * @returns BaseModelSql & LinkModelSql implementation
 *
 * @example
 * ```typescript
 * const model = getBaseModel({
 *   dbDriver: knex,
 *   modelId: 'table_xyz',
 *   models: allTableDefinitions,
 *   type: 'json' // default
 * });
 *
 * // CRUD operations
 * const record = await model.insert({ name: 'John', email: 'john@example.com' });
 * const records = await model.list({ limit: 10 });
 * await model.updateByPk(record.id, { name: 'Jane' });
 *
 * // Link operations (if using 'json' or 'link' type)
 * await model.mmList({ colId: 'link_col_id', parentRowId: record.id });
 * await model.addChild({ colId: 'link_col_id', rowId: record.id, childId: 'child_id' });
 * ```
 */
function getBaseModel(params) {
    const { type = 'json', ...rest } = params;
    switch (type) {
        case 'json':
            return new JSONModelSqlImp_1.JSONModelSqlImp(rest);
        case 'link':
            return new JSONLinkModelSql_1.JSONLinkModelSql(rest);
        case 'lazyload':
            return new LazyloadLinkModelSql_1.LazyloadLinkModelSql(rest);
        case 'copy':
            return new CopySqlImp_1.CopySqlImp(rest);
        default:
            return new JSONModelSqlImp_1.JSONModelSqlImp(rest);
    }
}
/**
 * Get a link model instance (only link operations)
 *
 * @param params - Parameters for model creation
 * @returns LinkModelSql implementation
 */
function getLinkModel(params) {
    return new JSONLinkModelSql_1.JSONLinkModelSql(params);
}
/**
 * Get a lazy loading model instance
 *
 * @param params - Parameters for model creation
 * @returns LazyloadLinkModelSql implementation
 */
function getLazyloadModel(params) {
    return new LazyloadLinkModelSql_1.LazyloadLinkModelSql(params);
}
/**
 * Get a copy-enabled model instance
 *
 * @param params - Parameters for model creation
 * @returns CopySqlImp implementation
 */
function getCopyModel(params) {
    return new CopySqlImp_1.CopySqlImp(params);
}
// ========================================
// Database Setup
// ========================================
/**
 * Create the required database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are created
 *
 * @example
 * ```typescript
 * await createTables(knex);
 * ```
 */
async function createTables(dbDriver) {
    // Create main data table
    const hasMainTable = await dbDriver.schema.hasTable('nc_bigtable');
    if (!hasMainTable) {
        await dbDriver.schema.createTable('nc_bigtable', (table) => {
            table.string('id').primary();
            table.string('fk_table_id').notNullable();
            table.timestamp('created_at').defaultTo(dbDriver.fn.now());
            table.timestamp('updated_at').defaultTo(dbDriver.fn.now());
            table.string('created_by');
            table.string('updated_by');
            table.jsonb('data');
            // Indexes
            table.index(['fk_table_id']);
            table.index(['fk_table_id', 'created_at']);
            table.index(['fk_table_id', 'updated_at']);
        });
        // Create GIN index for JSONB
        await dbDriver.raw('CREATE INDEX IF NOT EXISTS idx_nc_bigtable_data ON nc_bigtable USING GIN(data)');
    }
    // Create relations table
    const hasRelationsTable = await dbDriver.schema.hasTable('nc_bigtable_relations');
    if (!hasRelationsTable) {
        await dbDriver.schema.createTable('nc_bigtable_relations', (table) => {
            table.string('id').primary();
            table.string('fk_table_id').notNullable();
            table.string('fk_parent_id');
            table.string('fk_child_id');
            table.timestamp('created_at').defaultTo(dbDriver.fn.now());
            table.timestamp('updated_at').defaultTo(dbDriver.fn.now());
            // Indexes
            table.index(['fk_table_id', 'fk_parent_id']);
            table.index(['fk_table_id', 'fk_child_id']);
            table.index(['fk_table_id', 'fk_parent_id', 'fk_child_id']);
        });
    }
}
/**
 * Drop the database tables
 *
 * @param dbDriver - Knex instance
 * @returns Promise that resolves when tables are dropped
 */
async function dropTables(dbDriver) {
    await dbDriver.schema.dropTableIfExists('nc_bigtable_relations');
    await dbDriver.schema.dropTableIfExists('nc_bigtable');
}
// ========================================
// Default Export
// ========================================
exports.default = {
    getBaseModel,
    getLinkModel,
    getLazyloadModel,
    getCopyModel,
    createTables,
    dropTables,
};
//# sourceMappingURL=index.js.map