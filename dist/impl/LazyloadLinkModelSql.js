"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyloadLinkModelSql = void 0;
const JSONModelSqlImp_1 = require("./JSONModelSqlImp");
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
/**
 * Lazy loading link model implementation
 * Loads related data on demand rather than upfront
 */
class LazyloadLinkModelSql extends JSONModelSqlImp_1.JSONModelSqlImp {
    // Cache for loaded relations
    _relationCache = new Map();
    constructor(params) {
        super(params);
    }
    // ========================================
    // Lazy Loading Methods
    // ========================================
    /**
     * Load related records for a single record lazily
     */
    async loadRelated(record, colId, args = {}) {
        const recordId = record.id;
        if (!recordId) {
            return [];
        }
        // Check cache
        const cacheKey = `${colId}:${recordId}`;
        if (this._relationCache.has(colId)) {
            const colCache = this._relationCache.get(colId);
            if (colCache.has(recordId)) {
                return colCache.get(recordId);
            }
        }
        // Load from database
        const relatedRecords = await this.mmList({ colId, parentRowId: recordId }, args);
        // Cache result
        if (!this._relationCache.has(colId)) {
            this._relationCache.set(colId, new Map());
        }
        this._relationCache.get(colId).set(recordId, relatedRecords);
        return relatedRecords;
    }
    /**
     * Batch load related records for multiple records
     * More efficient than loading one by one
     */
    async batchLoadRelated(records, colId, args = {}) {
        const result = new Map();
        if (records.length === 0) {
            return result;
        }
        // Get relation column
        const relColumn = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model).find((c) => c.id === colId);
        if (!relColumn) {
            return result;
        }
        const colOptions = relColumn.colOptions;
        if (!colOptions || colOptions.type !== types_1.RelationTypes.MANY_TO_MANY) {
            return result;
        }
        // Get MM and child tables
        const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
        if (!mmTableId) {
            return result;
        }
        const mmTable = (0, queryBuilderHelper_1.getTableByIdMust)(mmTableId, this._models);
        const childTableId = (0, queryBuilderHelper_1.getChildTableIdFromMM)(this._model.id, mmTable);
        if (!childTableId) {
            return result;
        }
        const childTable = (0, queryBuilderHelper_1.getTableByIdMust)(childTableId, this._models);
        // Get all parent IDs
        const parentIds = records.map((r) => r.id).filter(Boolean);
        // Query all relations at once
        const allRelations = await this._dbDriver('nc_bigtable_relations')
            .select('fk_parent_id', 'fk_child_id')
            .where('fk_table_id', mmTable.id)
            .whereIn('fk_parent_id', parentIds);
        // Group by parent
        const relationsByParent = new Map();
        for (const rel of allRelations) {
            if (!relationsByParent.has(rel.fk_parent_id)) {
                relationsByParent.set(rel.fk_parent_id, []);
            }
            relationsByParent.get(rel.fk_parent_id).push(rel.fk_child_id);
        }
        // Get all unique child IDs
        const allChildIds = new Set();
        for (const childIds of relationsByParent.values()) {
            childIds.forEach((id) => allChildIds.add(id));
        }
        if (allChildIds.size === 0) {
            parentIds.forEach((id) => result.set(id, []));
            return result;
        }
        // Load all children at once
        const childRecords = await this._dbDriver('nc_bigtable')
            .select('*')
            .where('fk_table_id', childTable.id)
            .whereIn('id', Array.from(allChildIds));
        // Create lookup map
        const childById = new Map();
        for (const child of childRecords) {
            childById.set(child.id, this.parseRow(child));
        }
        // Build result
        for (const parentId of parentIds) {
            const childIds = relationsByParent.get(parentId) || [];
            const children = childIds
                .map((id) => childById.get(id))
                .filter(Boolean);
            result.set(parentId, children);
        }
        // Update cache
        if (!this._relationCache.has(colId)) {
            this._relationCache.set(colId, new Map());
        }
        const colCache = this._relationCache.get(colId);
        for (const [parentId, children] of result) {
            colCache.set(parentId, children);
        }
        return result;
    }
    /**
     * Clear relation cache
     */
    clearCache(colId) {
        if (colId) {
            this._relationCache.delete(colId);
        }
        else {
            this._relationCache.clear();
        }
    }
    // ========================================
    // List with Lazy Loading Support
    // ========================================
    /**
     * List records and optionally preload specific relations
     */
    async listWithRelations(args) {
        const { preloadRelations, ...listArgs } = args;
        // Get base records
        const records = await this.list(listArgs);
        // Preload specified relations
        const relations = new Map();
        if (preloadRelations && preloadRelations.length > 0 && records.length > 0) {
            for (const colId of preloadRelations) {
                const relMap = await this.batchLoadRelated(records, colId);
                relations.set(colId, relMap);
            }
        }
        return { records, relations };
    }
    /**
     * Read by PK with lazy loading support
     */
    async readByPkWithRelations(id, options) {
        const record = await this.readByPk(id, options?.fields);
        const relations = new Map();
        if (record && options?.loadRelations) {
            for (const colId of options.loadRelations) {
                const related = await this.loadRelated(record, colId);
                relations.set(colId, related);
            }
        }
        return { record, relations };
    }
    // ========================================
    // Row Parsing Override
    // ========================================
    parseRow(row) {
        const parsed = super['parseRow'](row);
        // Initialize lazy loading proxies for relation columns
        // This could be enhanced to use JavaScript Proxy for true lazy loading
        return parsed;
    }
}
exports.LazyloadLinkModelSql = LazyloadLinkModelSql;
//# sourceMappingURL=LazyloadLinkModelSql.js.map