"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractBaseModelSql = void 0;
const lodash_1 = __importDefault(require("lodash"));
const ulid_1 = require("ulid");
const NcError_1 = require("../interface/NcError");
const types_1 = require("../interface/types");
const queryBuilderHelper_1 = require("../helpers/queryBuilderHelper");
const sanitize_1 = require("../helpers/sanitize");
const condition_1 = require("../helpers/condition");
const sortBuilder_1 = require("../helpers/sortBuilder");
/**
 * Abstract base class implementing BaseModelSql interface
 * Provides core CRUD functionality for JSON-based storage
 */
class AbstractBaseModelSql {
    // ========================================
    // Properties
    // ========================================
    _dbDriver;
    _modelId;
    _viewId;
    _models;
    _model;
    _alias;
    _config;
    // Column cache
    _columnCache = new Map();
    // ========================================
    // Constructor
    // ========================================
    constructor(params) {
        this._dbDriver = params.dbDriver;
        this._modelId = params.modelId;
        this._viewId = params.viewId;
        this._models = params.models;
        this._alias = params.alias;
        this._config = { ...types_1.DEFAULT_MODEL_CONFIG, ...params.config };
        // Find the current model
        const model = params.models.find((m) => m.id === params.modelId);
        if (!model) {
            NcError_1.NcError.tableNotFound(params.modelId);
        }
        this._model = model;
    }
    // ========================================
    // Getters (Interface Properties)
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
    get config() {
        return this._config;
    }
    // ========================================
    // Query Builder Methods
    // ========================================
    getQueryBuilder() {
        return (0, queryBuilderHelper_1.getQueryBuilder)(this._dbDriver, this._model, this._alias);
    }
    getInsertQueryBuilder() {
        return (0, queryBuilderHelper_1.getInsertQueryBuilder)(this._dbDriver, this._model);
    }
    getSqlTableName(useAlias = false) {
        return (0, queryBuilderHelper_1.getSqlTableName)(this._model, useAlias ? this._alias : undefined);
    }
    getSqlColumnName(column, model) {
        return (0, queryBuilderHelper_1.getSqlColumnName)(column, model || this._model, this._alias);
    }
    async buildSelectQuery(params) {
        const { qb, columns } = params;
        const columnsToSelect = (0, queryBuilderHelper_1.parseFields)(columns, this._model);
        const selects = (0, queryBuilderHelper_1.buildColumnSelects)(columnsToSelect, this._model, this._alias, this._dbDriver);
        qb.select(selects);
        return qb;
    }
    async applySortAndFilter(qb, args) {
        // Apply filters
        if (args.filterArr && args.filterArr.length > 0) {
            await (0, condition_1.conditionV2)(args.filterArr, qb, this._model, this._models, this._dbDriver);
        }
        // Apply where string (legacy format)
        if (args.where) {
            const filters = (0, condition_1.parseWhereString)(args.where, this._model);
            if (filters.length > 0) {
                await (0, condition_1.conditionV2)(filters, qb, this._model, this._models, this._dbDriver);
            }
        }
        // Apply sorts
        if (args.sortArr && args.sortArr.length > 0) {
            await (0, sortBuilder_1.sortV2)(args.sortArr, qb, this._model, this._models, this._dbDriver, this._alias);
        }
        // Apply sort string (legacy format)
        if (args.sort) {
            const sorts = (0, sortBuilder_1.parseSortString)(args.sort, this._model);
            if (sorts.length > 0) {
                await (0, sortBuilder_1.sortV2)(sorts, qb, this._model, this._models, this._dbDriver, this._alias);
            }
        }
        return qb;
    }
    async extractRawQueryAndExec(qb, driver) {
        const db = driver || this._dbDriver;
        try {
            const result = await qb;
            // Parse JSONB data fields
            if (Array.isArray(result)) {
                return result.map((row) => this.parseRow(row));
            }
            return result;
        }
        catch (error) {
            console.error('Query execution error:', error);
            throw error;
        }
    }
    // ========================================
    // Data Transformation Methods
    // ========================================
    /**
     * Parse a row from database, handling JSONB data
     */
    parseRow(row) {
        if (!row)
            return row;
        // If row has 'data' field as string, parse it
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
        // If row has 'data' field as object, merge it
        if (row.data && typeof row.data === 'object') {
            const { data, ...systemFields } = row;
            return { ...systemFields, ...data };
        }
        return row;
    }
    /**
     * Map field aliases to column names and separate system/user fields
     */
    mapAliasToColumn(data, isUpdate = false) {
        const system = {};
        const userData = {};
        const columns = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model);
        for (const [key, value] of Object.entries(data)) {
            // Find matching column
            const column = columns.find((c) => c.id === key || c.title === key || c.column_name === key);
            if (!column) {
                // Unknown field, add to user data
                userData[key] = value;
                continue;
            }
            // Skip virtual columns
            if ((0, queryBuilderHelper_1.isVirtualColumn)(column)) {
                continue;
            }
            // System columns go to system object
            if ((0, queryBuilderHelper_1.isSystemColumn)(column)) {
                if (column.uidt === types_1.UITypes.ID) {
                    system.id = value;
                }
                else if (column.uidt === types_1.UITypes.CreatedTime && !isUpdate) {
                    // Set created_at only on insert
                    system.created_at = value;
                }
                else if (column.uidt === types_1.UITypes.LastModifiedTime) {
                    system.updated_at = value;
                }
                else if (column.uidt === types_1.UITypes.CreatedBy && !isUpdate) {
                    system.created_by = value;
                }
                else if (column.uidt === types_1.UITypes.LastModifiedBy) {
                    system.updated_by = value;
                }
            }
            else {
                // User columns go to data object
                userData[column.column_name] = this.convertValueForColumn(column, value);
            }
        }
        return { system, data: userData };
    }
    /**
     * Convert value based on column type
     */
    convertValueForColumn(column, value) {
        if (value === null || value === undefined) {
            return null;
        }
        switch (column.uidt) {
            case types_1.UITypes.Checkbox:
                return Boolean(value);
            case types_1.UITypes.Number:
            case types_1.UITypes.Decimal:
            case types_1.UITypes.Currency:
            case types_1.UITypes.Percent:
            case types_1.UITypes.Rating:
            case types_1.UITypes.AutoNumber:
                if (typeof value === 'string') {
                    const num = parseFloat(value);
                    return isNaN(num) ? null : num;
                }
                return value;
            case types_1.UITypes.JSON:
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    }
                    catch {
                        return value;
                    }
                }
                return value;
            case types_1.UITypes.MultiSelect:
                if (Array.isArray(value)) {
                    return value;
                }
                if (typeof value === 'string') {
                    try {
                        return JSON.parse(value);
                    }
                    catch {
                        return value.split(',').map((v) => v.trim());
                    }
                }
                return [value];
            default:
                return value;
        }
    }
    /**
     * Populate primary key if not provided
     */
    populatePk(data) {
        const pk = (0, queryBuilderHelper_1.getPrimaryKeyMust)(this._model);
        const pkField = pk.column_name || pk.title || 'id';
        if (!data[pkField] && !data.id) {
            data.id = (0, ulid_1.ulid)();
        }
    }
    /**
     * Add bigtable-specific fields for insert
     */
    addBigtableDataForInsert(mapped, cookie) {
        const now = new Date().toISOString();
        const insertObj = {
            id: mapped.system.id || (0, ulid_1.ulid)(),
            fk_table_id: this._model.id,
            created_at: mapped.system.created_at || now,
            updated_at: mapped.system.updated_at || now,
            created_by: mapped.system.created_by || cookie?.user?.id || null,
            updated_by: mapped.system.updated_by || cookie?.user?.id || null,
            data: JSON.stringify(mapped.data),
        };
        return insertObj;
    }
    /**
     * Add bigtable-specific fields for update
     */
    addBigtableDataForUpdate(mapped, cookie) {
        const now = new Date().toISOString();
        const updateObj = {
            updated_at: now,
            updated_by: cookie?.user?.id || null,
            data: JSON.stringify(mapped.data),
        };
        return updateObj;
    }
    /**
     * Build WHERE clause for primary key
     */
    _wherePk(id) {
        return (0, queryBuilderHelper_1.wherePk)(this._model, id, this._alias);
    }
    // ========================================
    // Validation
    // ========================================
    async validate(columns) {
        // Basic validation - can be extended
        for (const column of columns) {
            if (column.rqd) {
                // Required field validation would happen here
            }
        }
        return true;
    }
    // ========================================
    // CRUD Operations
    // ========================================
    async readByPk(id, fields) {
        const qb = this.getQueryBuilder();
        await this.buildSelectQuery({ qb, columns: fields });
        qb.where(this._wherePk(id));
        qb.limit(1);
        const result = await this.extractRawQueryAndExec(qb);
        return result.length > 0 ? result[0] : null;
    }
    async exist(id) {
        const qb = this.getQueryBuilder();
        qb.select(this._dbDriver.raw('1'));
        qb.where(this._wherePk(id));
        qb.limit(1);
        const result = await qb;
        return result.length > 0;
    }
    async findOne(args) {
        const results = await this.list({ ...args, limit: 1 });
        return results.length > 0 ? results[0] : null;
    }
    async insert(data, trx, cookie) {
        // Sanitize input
        const sanitizedData = (0, sanitize_1.sanitize)(data);
        // Populate primary key
        this.populatePk(sanitizedData);
        // Map to columns and separate system/user fields
        const mapped = this.mapAliasToColumn(sanitizedData, false);
        // Build insert object
        const insertObj = this.addBigtableDataForInsert(mapped, cookie);
        // Execute insert
        const qb = this.getInsertQueryBuilder();
        if (trx) {
            qb.transacting(trx);
        }
        await qb.insert(insertObj);
        // Return the inserted record
        return this.readByPk(insertObj.id);
    }
    async updateByPk(id, data, trx, cookie) {
        // Check if record exists
        const existing = await this.readByPk(id);
        if (!existing) {
            NcError_1.NcError.recordNotFound(id, this._model.title);
        }
        // Sanitize input
        const sanitizedData = (0, sanitize_1.sanitize)(data);
        // Merge with existing data (for JSONB fields)
        const mergedData = { ...existing, ...sanitizedData };
        // Map to columns
        const mapped = this.mapAliasToColumn(mergedData, true);
        // Build update object
        const updateObj = this.addBigtableDataForUpdate(mapped, cookie);
        // Execute update
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE);
        if (trx) {
            qb.transacting(trx);
        }
        qb.where('id', id);
        qb.where('fk_table_id', this._model.id);
        await qb.update(updateObj);
        // Return updated record
        return this.readByPk(id);
    }
    async delByPk(id, trx, cookie) {
        // Check if record exists
        const exists = await this.exist(id);
        if (!exists) {
            NcError_1.NcError.recordNotFound(id, this._model.title);
        }
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE);
        if (trx) {
            qb.transacting(trx);
        }
        qb.where('id', id);
        qb.where('fk_table_id', this._model.id);
        return await qb.delete();
    }
    // ========================================
    // List Operations
    // ========================================
    async list(args = {}, ignoreFilterSort = false) {
        const qb = this.getQueryBuilder();
        // Build SELECT
        await this.buildSelectQuery({ qb, columns: args.fields });
        // Apply filters and sorts
        if (!ignoreFilterSort) {
            await this.applySortAndFilter(qb, args);
        }
        // Apply pagination
        (0, queryBuilderHelper_1.applyPagination)(qb, args.limit, args.offset, this._config);
        // Execute and return
        return this.extractRawQueryAndExec(qb);
    }
    async count(args = {}, ignoreFilterSort = false) {
        const qb = this.getQueryBuilder();
        qb.count('* as count');
        // Apply filters
        if (!ignoreFilterSort) {
            if (args.filterArr && args.filterArr.length > 0) {
                await (0, condition_1.conditionV2)(args.filterArr, qb, this._model, this._models, this._dbDriver);
            }
            if (args.where) {
                const filters = (0, condition_1.parseWhereString)(args.where, this._model);
                if (filters.length > 0) {
                    await (0, condition_1.conditionV2)(filters, qb, this._model, this._models, this._dbDriver);
                }
            }
        }
        const result = await qb;
        return parseInt(result[0]?.count || '0', 10);
    }
    // ========================================
    // Bulk Operations
    // ========================================
    async bulkInsert(datas, options = {}) {
        const { chunkSize = 100, cookie, trx } = options;
        const chunks = lodash_1.default.chunk(datas, chunkSize);
        const insertedIds = [];
        for (const chunk of chunks) {
            const insertObjs = chunk.map((data) => {
                const sanitizedData = (0, sanitize_1.sanitize)(data);
                this.populatePk(sanitizedData);
                const mapped = this.mapAliasToColumn(sanitizedData, false);
                const insertObj = this.addBigtableDataForInsert(mapped, cookie);
                insertedIds.push(insertObj.id);
                return insertObj;
            });
            const qb = this.getInsertQueryBuilder();
            if (trx) {
                qb.transacting(trx);
            }
            await qb.insert(insertObjs);
        }
        // Return all inserted records
        const results = [];
        for (const id of insertedIds) {
            const record = await this.readByPk(id);
            if (record) {
                results.push(record);
            }
        }
        return results;
    }
    async bulkUpdate(datas, options = {}) {
        const { cookie, trx } = options;
        const results = [];
        const pk = (0, queryBuilderHelper_1.getPrimaryKeyMust)(this._model);
        const pkField = pk.column_name || pk.title || 'id';
        for (const data of datas) {
            const id = data[pkField] || data.id;
            if (!id) {
                continue;
            }
            const result = await this.updateByPk(id, data, trx, cookie);
            results.push(result);
        }
        return results;
    }
    async bulkUpdateAll(args, data, options = {}) {
        const { cookie, trx } = options;
        // Get all matching record IDs
        const records = await this.list({ ...args, fields: ['id'] }, false);
        const ids = records.map((r) => r.id);
        if (ids.length === 0) {
            return 0;
        }
        // Sanitize update data
        const sanitizedData = (0, sanitize_1.sanitize)(data);
        const mapped = this.mapAliasToColumn(sanitizedData, true);
        const updateObj = this.addBigtableDataForUpdate(mapped, cookie);
        // Execute bulk update
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE);
        if (trx) {
            qb.transacting(trx);
        }
        qb.whereIn('id', ids);
        qb.where('fk_table_id', this._model.id);
        await qb.update(updateObj);
        return ids.length;
    }
    async bulkDelete(ids, options = {}) {
        const { trx } = options;
        if (ids.length === 0) {
            return 0;
        }
        const qb = this._dbDriver(queryBuilderHelper_1.NC_BIGTABLE);
        if (trx) {
            qb.transacting(trx);
        }
        qb.whereIn('id', ids);
        qb.where('fk_table_id', this._model.id);
        return await qb.delete();
    }
    async bulkDeleteAll(args = {}, options = {}) {
        // Get all matching record IDs
        const records = await this.list({ ...args, fields: ['id'] }, false);
        const ids = records.map((r) => r.id);
        return this.bulkDelete(ids, options);
    }
    // ========================================
    // Aggregation Operations
    // ========================================
    async groupBy(args) {
        const { column_name, aggregation = 'count' } = args;
        const column = (0, queryBuilderHelper_1.getColumnsIncludingPk)(this._model).find((c) => c.column_name === column_name || c.title === column_name);
        if (!column) {
            return [];
        }
        const sqlCol = this.getSqlColumnName(column);
        const qb = this.getQueryBuilder();
        // Add group by column
        qb.select(this._dbDriver.raw(`${sqlCol} as "${column_name}"`));
        // Add aggregation
        switch (aggregation.toLowerCase()) {
            case 'count':
                qb.count('* as count');
                break;
            case 'sum':
                qb.sum(`${sqlCol} as sum`);
                break;
            case 'avg':
                qb.avg(`${sqlCol} as avg`);
                break;
            case 'min':
                qb.min(`${sqlCol} as min`);
                break;
            case 'max':
                qb.max(`${sqlCol} as max`);
                break;
            default:
                qb.count('* as count');
        }
        qb.groupBy(this._dbDriver.raw(sqlCol));
        // Apply filters
        await this.applySortAndFilter(qb, args);
        // Apply pagination
        (0, queryBuilderHelper_1.applyPagination)(qb, args.limit, args.offset, this._config);
        return this.extractRawQueryAndExec(qb);
    }
    async groupByV2(args) {
        // V2 is the same as V1 for now
        return this.groupBy(args);
    }
}
exports.AbstractBaseModelSql = AbstractBaseModelSql;
//# sourceMappingURL=AbstractBaseModelSql.js.map