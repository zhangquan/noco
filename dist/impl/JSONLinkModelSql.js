"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONLinkModelSql = void 0;
const ulid_1 = require("ulid");
const NcError_1 = require("../interface/NcError");
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
const condition_1 = require("../helpers/condition");
const sortBuilder_1 = require("../helpers/sortBuilder");
/**
 * Independent Link Model implementation
 * Does not extend AbstractBaseModelSql - implements interfaces directly
 * Useful for scenarios where only link operations are needed
 */
class JSONLinkModelSql {
    _dbDriver;
    _modelId;
    _viewId;
    _models;
    _model;
    _alias;
    _config;
    constructor(params) {
        this._dbDriver = params.dbDriver;
        this._modelId = params.modelId;
        this._viewId = params.viewId;
        this._models = params.models;
        this._alias = params.alias;
        this._config = { ...types_1.DEFAULT_MODEL_CONFIG, ...params.config };
        const model = params.models.find((m) => m.id === params.modelId);
        if (!model) {
            NcError_1.NcError.tableNotFound(params.modelId);
        }
        this._model = model;
    }
    // ========================================
    // Interface Property Getters
    // ========================================
    get dbDriver() {
        return this._dbDriver;
    }
    get modelId() {
        return this._modelId;
    }
    get viewId() {
        return this._viewId;
    }
    get models() {
        return this._models;
    }
    get model() {
        return this._model;
    }
    get alias() {
        return this._alias;
    }
    // ========================================
    // MM List Operations
    // ========================================
    async mmList(params, args = {}) {
        const { colId, parentRowId } = params;
        const { mmTable, childTable } = this.getMMTablesForColumn(colId);
        // Build child IDs subquery
        const childIdsSubquery = this.mmSubQueryBuild(this._model, mmTable, parentRowId, args.limit, args.offset);
        // Build main query for child records
        const qb = (0, queryBuilderHelper_1.getQueryBuilder)(this._dbDriver, childTable, 'child');
        qb.whereIn('child.id', childIdsSubquery);
        // Build SELECT
        this.buildChildSelectQuery(qb, childTable);
        // Apply filters and sorts
        if (args.filterArr && args.filterArr.length > 0) {
            await (0, condition_1.conditionV2)(args.filterArr, qb, childTable, this._models, this._dbDriver);
        }
        if (args.sortArr && args.sortArr.length > 0) {
            await (0, sortBuilder_1.sortV2)(args.sortArr, qb, childTable, this._models, this._dbDriver, 'child');
        }
        return this.extractRawQueryAndExec(qb);
    }
    async mmListCount(params) {
        const { colId, parentRowId } = params;
        try {
            const { mmTable } = this.getMMTablesForColumn(colId);
            const countQuery = this.mmCountSubQueryBuild(this._model, mmTable, parentRowId);
            const result = await countQuery;
            return parseInt(result[0]?.count || '0', 10);
        }
        catch {
            return 0;
        }
    }
    // ========================================
    // MM Excluded List Operations
    // ========================================
    async getMmChildrenExcludedList(params, args = {}) {
        const { colId, parentRowId } = params;
        const { mmTable, childTable } = this.getMMTablesForColumn(colId);
        // Build child IDs subquery (linked records)
        const linkedChildIdsSubquery = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
            .select('fk_child_id')
            .where('fk_table_id', mmTable.id)
            .where('fk_parent_id', parentRowId);
        // Build main query for excluded records
        const qb = (0, queryBuilderHelper_1.getQueryBuilder)(this._dbDriver, childTable, 'child');
        qb.whereNotIn('child.id', linkedChildIdsSubquery);
        // Build SELECT
        this.buildChildSelectQuery(qb, childTable);
        // Apply filters and sorts
        if (args.filterArr && args.filterArr.length > 0) {
            await (0, condition_1.conditionV2)(args.filterArr, qb, childTable, this._models, this._dbDriver);
        }
        if (args.sortArr && args.sortArr.length > 0) {
            await (0, sortBuilder_1.sortV2)(args.sortArr, qb, childTable, this._models, this._dbDriver, 'child');
        }
        // Apply pagination
        (0, queryBuilderHelper_1.applyPagination)(qb, args.limit, args.offset, this._config);
        return this.extractRawQueryAndExec(qb);
    }
    async getMmChildrenExcludedListCount(params, args = {}) {
        const { colId, parentRowId } = params;
        try {
            const { mmTable, childTable } = this.getMMTablesForColumn(colId);
            const linkedChildIdsSubquery = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
                .select('fk_child_id')
                .where('fk_table_id', mmTable.id)
                .where('fk_parent_id', parentRowId);
            const qb = (0, queryBuilderHelper_1.getQueryBuilder)(this._dbDriver, childTable, 'child');
            qb.count('* as count');
            qb.whereNotIn('child.id', linkedChildIdsSubquery);
            if (args.filterArr && args.filterArr.length > 0) {
                await (0, condition_1.conditionV2)(args.filterArr, qb, childTable, this._models, this._dbDriver);
            }
            const result = await qb;
            return parseInt(result[0]?.count || '0', 10);
        }
        catch {
            return 0;
        }
    }
    // ========================================
    // MM Relationship Operations
    // ========================================
    async hasChild(params) {
        const { colId, parentRowId, childRowId } = params;
        try {
            const { mmTable } = this.getMMTablesForColumn(colId);
            const result = await this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
                .select(this._dbDriver.raw('1'))
                .where('fk_table_id', mmTable.id)
                .where('fk_parent_id', parentRowId)
                .where('fk_child_id', childRowId)
                .limit(1);
            return result.length > 0;
        }
        catch {
            return false;
        }
    }
    async addChild(params) {
        const { colId, rowId, childId, cookie, trx } = params;
        // Check if already linked
        const exists = await this.hasChild({
            colId,
            parentRowId: rowId,
            childRowId: childId,
        });
        if (exists) {
            return true;
        }
        const { mmTable } = this.getMMTablesForColumn(colId);
        const now = new Date().toISOString();
        const insertObj = {
            id: (0, ulid_1.ulid)(),
            fk_table_id: mmTable.id,
            fk_parent_id: rowId,
            fk_child_id: childId,
            created_at: now,
            updated_at: now,
        };
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS);
        if (trx) {
            qb.transacting(trx);
        }
        await qb.insert(insertObj);
        return true;
    }
    async removeChild(params) {
        const { colId, rowId, childId, trx } = params;
        const { mmTable } = this.getMMTablesForColumn(colId);
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS);
        if (trx) {
            qb.transacting(trx);
        }
        const deleted = await qb
            .where('fk_table_id', mmTable.id)
            .where('fk_parent_id', rowId)
            .where('fk_child_id', childId)
            .delete();
        return deleted > 0;
    }
    // ========================================
    // MM Bulk Operations
    // ========================================
    /**
     * Add multiple children at once
     */
    async addChildren(params) {
        const { colId, rowId, childIds, cookie, trx } = params;
        if (childIds.length === 0) {
            return 0;
        }
        const { mmTable } = this.getMMTablesForColumn(colId);
        const now = new Date().toISOString();
        // Get existing links to avoid duplicates
        const existing = await this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
            .select('fk_child_id')
            .where('fk_table_id', mmTable.id)
            .where('fk_parent_id', rowId)
            .whereIn('fk_child_id', childIds);
        const existingChildIds = new Set(existing.map((r) => r.fk_child_id));
        const newChildIds = childIds.filter((id) => !existingChildIds.has(id));
        if (newChildIds.length === 0) {
            return 0;
        }
        const insertObjs = newChildIds.map((childId) => ({
            id: (0, ulid_1.ulid)(),
            fk_table_id: mmTable.id,
            fk_parent_id: rowId,
            fk_child_id: childId,
            created_at: now,
            updated_at: now,
        }));
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS);
        if (trx) {
            qb.transacting(trx);
        }
        await qb.insert(insertObjs);
        return newChildIds.length;
    }
    /**
     * Remove multiple children at once
     */
    async removeChildren(params) {
        const { colId, rowId, childIds, trx } = params;
        if (childIds.length === 0) {
            return 0;
        }
        const { mmTable } = this.getMMTablesForColumn(colId);
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS);
        if (trx) {
            qb.transacting(trx);
        }
        return await qb
            .where('fk_table_id', mmTable.id)
            .where('fk_parent_id', rowId)
            .whereIn('fk_child_id', childIds)
            .delete();
    }
    // ========================================
    // MM Query Building
    // ========================================
    mmSubQueryBuild(mainTable, mmTable, parentRowId, limit, offset) {
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
            .select('fk_child_id')
            .where('fk_table_id', mmTable.id);
        if (parentRowId) {
            qb.where('fk_parent_id', parentRowId);
        }
        if (limit !== undefined) {
            qb.limit(limit);
        }
        if (offset !== undefined && offset > 0) {
            qb.offset(offset);
        }
        return qb;
    }
    mmCountSubQueryBuild(mainTable, mmTable, parentRowId) {
        return this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
            .count('* as count')
            .where('fk_table_id', mmTable.id)
            .where('fk_parent_id', parentRowId);
    }
    // ========================================
    // Helper Methods
    // ========================================
    getMMTablesForColumn(colId) {
        const relColumn = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model).find((c) => c.id === colId);
        if (!relColumn) {
            NcError_1.NcError.columnNotFound(colId);
        }
        const colOptions = relColumn.colOptions;
        if (!colOptions || colOptions.type !== types_1.RelationTypes.MANY_TO_MANY) {
            NcError_1.NcError.badRequest('Column is not a many-to-many relation');
        }
        const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
        if (!mmTableId) {
            NcError_1.NcError.badRequest('MM table not configured');
        }
        const mmTable = (0, queryBuilderHelper_1.getTableByIdMust)(mmTableId, this._models);
        const childTableId = (0, queryBuilderHelper_1.getChildTableIdFromMM)(this._model.id, mmTable);
        if (!childTableId) {
            NcError_1.NcError.badRequest('Could not determine child table');
        }
        const childTable = (0, queryBuilderHelper_1.getTableByIdMust)(childTableId, this._models);
        return { mmTable, childTable, colOptions };
    }
    buildChildSelectQuery(qb, childTable) {
        const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(childTable);
        const selects = (0, queryBuilderHelper_1.buildColumnSelects)(columns.filter((c) => c.uidt !== 'LinkToAnotherRecord'), childTable, 'child', this._dbDriver);
        qb.select(selects);
    }
    parseRow(row) {
        if (!row)
            return row;
        if (typeof row.data === 'string') {
            try {
                const data = JSON.parse(row.data);
                const { data: _, ...systemFields } = row;
                return { ...systemFields, ...data };
            }
            catch {
                return row;
            }
        }
        if (row.data && typeof row.data === 'object') {
            const { data, ...systemFields } = row;
            return { ...systemFields, ...data };
        }
        return row;
    }
    async extractRawQueryAndExec(qb) {
        const result = await qb;
        if (Array.isArray(result)) {
            return result.map((row) => this.parseRow(row));
        }
        return result;
    }
}
exports.JSONLinkModelSql = JSONLinkModelSql;
//# sourceMappingURL=JSONLinkModelSql.js.map