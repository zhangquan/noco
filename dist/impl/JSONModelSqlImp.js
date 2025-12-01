"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONModelSqlImp = void 0;
const AbstractLinkModelSql_1 = require("../abstract/AbstractLinkModelSql");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
const formulaQueryBuilderV2_1 = require("../queryBuilder/formulaQueryBuilderV2");
const genRollupSelectV2_1 = require("../queryBuilder/genRollupSelectV2");
const genLinkCountToSelect_1 = require("../queryBuilder/genLinkCountToSelect");
/**
 * Main JSON-based model implementation
 * Implements all CRUD and link operations for JSONB storage
 */
class JSONModelSqlImp extends AbstractLinkModelSql_1.AbstractLinkModelSql {
    // ========================================
    // Constructor
    // ========================================
    constructor(params) {
        super(params);
    }
    // ========================================
    // Enhanced Query Building
    // ========================================
    /**
     * Build SELECT query with support for virtual columns
     */
    async buildSelectQuery(params) {
        const { qb, columns } = params;
        const columnsToSelect = (0, queryBuilderHelper_1.parseFields)(columns, this._model);
        // Basic column selects
        const selects = (0, queryBuilderHelper_1.buildColumnSelects)(columnsToSelect.filter((c) => !this.isVirtualColumnType(c.uidt)), this._model, this._alias, this._dbDriver);
        qb.select(selects);
        // Add virtual column selects
        for (const column of columnsToSelect) {
            if (this.isVirtualColumnType(column.uidt)) {
                await this.addVirtualColumnSelect(qb, column);
            }
        }
        return qb;
    }
    /**
     * Check if column type is virtual
     */
    isVirtualColumnType(uidt) {
        return ['Formula', 'Rollup', 'Lookup', 'LinkToAnotherRecord', 'Links'].includes(uidt);
    }
    /**
     * Add virtual column to SELECT
     */
    async addVirtualColumnSelect(qb, column) {
        const alias = column.title || column.column_name;
        switch (column.uidt) {
            case 'Formula':
                if (column.colOptions?.formula) {
                    const formulaExpr = await (0, formulaQueryBuilderV2_1.formulaQueryBuilderV2)(column.colOptions.formula, this._model, this._models, this._dbDriver);
                    qb.select(this._dbDriver.raw(`(${formulaExpr}) as ??`, [alias]));
                }
                break;
            case 'Rollup':
                if (column.colOptions) {
                    const rollupSubQuery = await (0, genRollupSelectV2_1.genRollupSelectV2)({
                        column,
                        model: this._model,
                        models: this._models,
                        dbDriver: this._dbDriver,
                        alias: this._alias,
                    });
                    qb.select(this._dbDriver.raw(`(${rollupSubQuery.toQuery()}) as ??`, [alias]));
                }
                break;
            case 'LinkToAnotherRecord':
            case 'Links':
                if (column.colOptions) {
                    const countSubQuery = (0, genLinkCountToSelect_1.genLinkCountToSelect)({
                        modelId: this._model.id,
                        column,
                        models: this._models,
                        dbDriver: this._dbDriver,
                        alias: this._alias,
                    });
                    qb.select(this._dbDriver.raw(`(${countSubQuery.toQuery()}) as ??`, [alias]));
                }
                break;
            // Lookup columns are handled differently - they require join or subquery
            case 'Lookup':
                // For simplicity, return NULL for lookups in list queries
                // Full lookup support would require subqueries for each lookup
                qb.select(this._dbDriver.raw(`NULL as ??`, [alias]));
                break;
        }
    }
    // ========================================
    // Data Conversion
    // ========================================
    /**
     * Convert data before insert (type coercion)
     */
    convertDataBeforeInsert(model, data) {
        const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(model);
        const converted = { ...data };
        for (const column of columns) {
            const key = column.column_name;
            if (key in converted) {
                converted[key] = this.convertValueForColumn(column, converted[key]);
            }
        }
        return converted;
    }
    // ========================================
    // Enhanced CRUD Operations
    // ========================================
    /**
     * Insert with full data conversion
     */
    async insert(data, trx, cookie) {
        // Convert data types
        const convertedData = this.convertDataBeforeInsert(this._model, data);
        // Use parent implementation
        return super.insert(convertedData, trx, cookie);
    }
    /**
     * Update with merge support
     */
    async updateByPk(id, data, trx, cookie) {
        // Convert data types
        const convertedData = this.convertDataBeforeInsert(this._model, data);
        // Use parent implementation
        return super.updateByPk(id, convertedData, trx, cookie);
    }
    // ========================================
    // List with Virtual Columns
    // ========================================
    /**
     * List records with virtual column support
     */
    async list(args = {}, ignoreFilterSort = false) {
        const qb = this.getQueryBuilder();
        // Build SELECT with virtual columns
        await this.buildSelectQuery({ qb, columns: args.fields });
        // Apply filters and sorts
        if (!ignoreFilterSort) {
            await this.applySortAndFilter(qb, args);
        }
        // Apply pagination
        const limit = Math.min(Math.max(args.limit ?? this._config.limitDefault, this._config.limitMin), this._config.limitMax);
        qb.limit(limit);
        if (args.offset !== undefined && args.offset > 0) {
            qb.offset(args.offset);
        }
        // Execute and return
        return this.extractRawQueryAndExec(qb);
    }
    // ========================================
    // Bulk Operations with Batching
    // ========================================
    /**
     * Bulk insert with transaction support
     */
    async bulkInsert(datas, options = {}) {
        const { chunkSize = 100, cookie, trx, skipValidation = false } = options;
        // If transaction provided, use it; otherwise create one
        if (trx) {
            return this._bulkInsertInternal(datas, chunkSize, cookie, trx);
        }
        // Use transaction for atomicity
        return this._dbDriver.transaction(async (transaction) => {
            return this._bulkInsertInternal(datas, chunkSize, cookie, transaction);
        });
    }
    async _bulkInsertInternal(datas, chunkSize, cookie, trx) {
        const results = [];
        const chunks = this.chunkArray(datas, chunkSize);
        for (const chunk of chunks) {
            const insertedRecords = await Promise.all(chunk.map((data) => this.insert(data, trx, cookie)));
            results.push(...insertedRecords);
        }
        return results;
    }
    /**
     * Bulk update with transaction support
     */
    async bulkUpdate(datas, options = {}) {
        const { cookie, trx } = options;
        if (trx) {
            return this._bulkUpdateInternal(datas, cookie, trx);
        }
        return this._dbDriver.transaction(async (transaction) => {
            return this._bulkUpdateInternal(datas, cookie, transaction);
        });
    }
    async _bulkUpdateInternal(datas, cookie, trx) {
        const results = [];
        for (const data of datas) {
            const id = data.id || data.Id;
            if (!id)
                continue;
            const updated = await this.updateByPk(id, data, trx, cookie);
            results.push(updated);
        }
        return results;
    }
    /**
     * Helper to chunk array
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    // ========================================
    // Read by PK with Lookup Support
    // ========================================
    /**
     * Read by PK with virtual columns
     */
    async readByPk(id, fields) {
        const qb = this.getQueryBuilder();
        // Build SELECT with virtual columns
        await this.buildSelectQuery({ qb, columns: fields });
        qb.where(this._wherePk(id));
        qb.limit(1);
        const result = await this.extractRawQueryAndExec(qb);
        return result.length > 0 ? result[0] : null;
    }
}
exports.JSONModelSqlImp = JSONModelSqlImp;
//# sourceMappingURL=JSONModelSqlImp.js.map