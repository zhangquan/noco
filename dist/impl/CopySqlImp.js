"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopySqlImp = void 0;
const ulid_1 = require("ulid");
const JSONModelSqlImp_1 = require("./JSONModelSqlImp");
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
/**
 * Data copy implementation
 * Provides functionality to copy records and their relationships
 */
class CopySqlImp extends JSONModelSqlImp_1.JSONModelSqlImp {
    constructor(params) {
        super(params);
    }
    // ========================================
    // Copy Operations
    // ========================================
    /**
     * Copy a single record
     */
    async copyRecord(id, options = {}) {
        const { copyRelations = false, excludeFields = [], transformers = {}, trx, cookie, } = options;
        // Read original record
        const original = await this.readByPk(id);
        if (!original) {
            throw new Error(`Record with id '${id}' not found`);
        }
        // Prepare copy data
        const copyData = this.prepareCopyData(original, excludeFields, transformers);
        // Generate new ID
        const newId = (0, ulid_1.ulid)();
        copyData.id = newId;
        // Insert copy
        const copied = await this.insert(copyData, trx, cookie);
        const result = {
            originalId: id,
            newId,
            record: copied,
        };
        // Copy relations if requested
        if (copyRelations) {
            result.copiedRelations = await this.copyRelations(id, newId, options);
        }
        return result;
    }
    /**
     * Copy multiple records
     */
    async copyRecords(ids, options = {}) {
        const results = [];
        // Use transaction for atomicity
        const trx = options.trx || (await this._dbDriver.transaction());
        try {
            for (const id of ids) {
                const result = await this.copyRecord(id, { ...options, trx });
                results.push(result);
            }
            // Commit if we created the transaction
            if (!options.trx) {
                await trx.commit();
            }
        }
        catch (error) {
            // Rollback if we created the transaction
            if (!options.trx) {
                await trx.rollback();
            }
            throw error;
        }
        return results;
    }
    /**
     * Copy an entire table's data
     */
    async copyTable(sourceTableId, targetTableId, options = {}) {
        const { trx, cookie, excludeFields = [], transformers = {} } = options;
        // Get source table records
        const sourceRecords = await this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE)
            .select('*')
            .where('fk_table_id', sourceTableId);
        const idMapping = new Map();
        const newRecords = [];
        // Prepare new records
        for (const record of sourceRecords) {
            const parsed = this.parseRowInternal(record);
            const copyData = this.prepareCopyData(parsed, excludeFields, transformers);
            const newId = (0, ulid_1.ulid)();
            idMapping.set(record.id, newId);
            newRecords.push({
                id: newId,
                fk_table_id: targetTableId,
                data: JSON.stringify(copyData),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: cookie?.user?.id || null,
                updated_by: cookie?.user?.id || null,
            });
        }
        // Insert all records
        if (newRecords.length > 0) {
            const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE);
            if (trx) {
                qb.transacting(trx);
            }
            await qb.insert(newRecords);
        }
        return {
            copiedCount: newRecords.length,
            idMapping,
        };
    }
    // ========================================
    // Relation Copy Operations
    // ========================================
    /**
     * Copy all MM relations for a record
     */
    async copyRelations(originalId, newId, options) {
        const { trx } = options;
        const copiedRelations = new Map();
        // Find all link columns
        const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model);
        const linkColumns = columns.filter((c) => c.uidt === 'LinkToAnotherRecord' &&
            c.colOptions?.type ===
                types_1.RelationTypes.MANY_TO_MANY);
        for (const linkCol of linkColumns) {
            const colOptions = linkCol.colOptions;
            const mmTableId = colOptions.fk_mm_model_id || colOptions.mm_model_id;
            if (!mmTableId)
                continue;
            const mmTable = (0, queryBuilderHelper_1.getTableByIdMust)(mmTableId, this._models);
            // Get original relations
            const originalRelations = await this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS)
                .select('fk_child_id')
                .where('fk_table_id', mmTable.id)
                .where('fk_parent_id', originalId);
            const childIds = originalRelations.map((r) => r.fk_child_id);
            copiedRelations.set(linkCol.id, childIds);
            // Create new relations
            const now = new Date().toISOString();
            const newRelations = childIds.map((childId) => ({
                id: (0, ulid_1.ulid)(),
                fk_table_id: mmTable.id,
                fk_parent_id: newId,
                fk_child_id: childId,
                created_at: now,
                updated_at: now,
            }));
            if (newRelations.length > 0) {
                const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE_RELATIONS);
                if (trx) {
                    qb.transacting(trx);
                }
                await qb.insert(newRelations);
            }
        }
        return copiedRelations;
    }
    /**
     * Deep copy - copy record and all linked records recursively
     */
    async deepCopy(id, options = {}) {
        const { maxDepth = 3, trx, cookie } = options;
        const all = new Map();
        const visited = new Set();
        const transaction = trx || (await this._dbDriver.transaction());
        try {
            const root = await this.deepCopyRecursive(id, { ...options, trx: transaction }, visited, all, 0, maxDepth);
            if (!trx) {
                await transaction.commit();
            }
            return { root, all };
        }
        catch (error) {
            if (!trx) {
                await transaction.rollback();
            }
            throw error;
        }
    }
    async deepCopyRecursive(id, options, visited, all, currentDepth, maxDepth) {
        // Check if already copied
        if (visited.has(id)) {
            return all.get(id);
        }
        visited.add(id);
        // Copy this record
        const result = await this.copyRecord(id, {
            ...options,
            copyRelations: false, // We handle relations ourselves
        });
        all.set(id, result);
        // If we haven't reached max depth, copy related records
        if (currentDepth < maxDepth) {
            const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model);
            const linkColumns = columns.filter((c) => c.uidt === 'LinkToAnotherRecord' &&
                c.colOptions?.type ===
                    types_1.RelationTypes.MANY_TO_MANY);
            for (const linkCol of linkColumns) {
                const relatedRecords = await this.mmList({ colId: linkCol.id, parentRowId: id }, {});
                for (const relatedRecord of relatedRecords) {
                    if (!visited.has(relatedRecord.id)) {
                        await this.deepCopyRecursive(relatedRecord.id, options, visited, all, currentDepth + 1, maxDepth);
                    }
                }
            }
        }
        return result;
    }
    // ========================================
    // Helper Methods
    // ========================================
    /**
     * Prepare copy data by excluding fields and applying transformers
     */
    prepareCopyData(original, excludeFields, transformers) {
        const copy = {};
        // Default excluded fields
        const defaultExcluded = new Set([
            'id',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
            'fk_table_id',
        ]);
        for (const [key, value] of Object.entries(original)) {
            // Skip excluded fields
            if (defaultExcluded.has(key) || excludeFields.includes(key)) {
                continue;
            }
            // Apply transformer if exists
            if (transformers[key]) {
                copy[key] = transformers[key](value);
            }
            else {
                copy[key] = value;
            }
        }
        return copy;
    }
    parseRowInternal(row) {
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
}
exports.CopySqlImp = CopySqlImp;
//# sourceMappingURL=CopySqlImp.js.map