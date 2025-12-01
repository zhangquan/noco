"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NC_BIGTABLE_RELATIONS = exports.NC_BIGTABLE = void 0;
exports.getSqlTableName = getSqlTableName;
exports.getTableWithAlias = getTableWithAlias;
exports.isSystemColumn = isSystemColumn;
exports.isVirtualColumn = isVirtualColumn;
exports.getSysColumnName = getSysColumnName;
exports.getSqlColumnName = getSqlColumnName;
exports.getSqlColumnNameWithCast = getSqlColumnNameWithCast;
exports.getColumns = getColumns;
exports.getColumnsIncludingPk = getColumnsIncludingPk;
exports.primaryKey = primaryKey;
exports.getPrimaryKeyMust = getPrimaryKeyMust;
exports.getColumnById = getColumnById;
exports.getColumnByName = getColumnByName;
exports.getTableById = getTableById;
exports.getTableByIdMust = getTableByIdMust;
exports.getChildTableIdFromMM = getChildTableIdFromMM;
exports.getMMColumnConfig = getMMColumnConfig;
exports.getQueryBuilder = getQueryBuilder;
exports.getInsertQueryBuilder = getInsertQueryBuilder;
exports.buildColumnSelects = buildColumnSelects;
exports.parseFields = parseFields;
exports.applyPagination = applyPagination;
exports.wherePk = wherePk;
const types_1 = require("../interface/types");
// ========================================
// Constants
// ========================================
/**
 * Main data table name
 */
exports.NC_BIGTABLE = 'nc_bigtable';
/**
 * Relations table name
 */
exports.NC_BIGTABLE_RELATIONS = 'nc_bigtable_relations';
// ========================================
// Table Name Helpers
// ========================================
/**
 * Get SQL table name for a model
 * @param model - Table/model definition
 * @param modelAlias - Optional alias
 * @returns SQL table name
 */
function getSqlTableName(model, modelAlias) {
    if (model.mm) {
        return modelAlias || exports.NC_BIGTABLE_RELATIONS;
    }
    return modelAlias || exports.NC_BIGTABLE;
}
/**
 * Get table name with alias for query
 * @param model - Table/model definition
 * @param alias - Alias to use
 * @returns Object with table name and alias for Knex
 */
function getTableWithAlias(model, alias) {
    const tableName = getSqlTableName(model);
    return { [alias]: tableName };
}
// ========================================
// Column Helpers
// ========================================
/**
 * Check if a column is a system column
 * @param column - Column definition
 * @returns True if system column
 */
function isSystemColumn(column) {
    return (column.system === true ||
        types_1.SystemColumnUITypes.includes(column.uidt) ||
        column.uidt === types_1.UITypes.ID);
}
/**
 * Check if a column is a virtual column (computed)
 * @param column - Column definition
 * @returns True if virtual column
 */
function isVirtualColumn(column) {
    return types_1.VirtualColumnUITypes.includes(column.uidt);
}
/**
 * Get system column name for a UI type
 * @param uidt - UI type
 * @returns System column name or null
 */
function getSysColumnName(uidt) {
    return types_1.SystemColumnNames[uidt] || null;
}
/**
 * Get SQL column expression for a column
 * @param column - Column definition
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @returns SQL column expression
 */
function getSqlColumnName(column, model, modelAlias) {
    const prefix = modelAlias || getSqlTableName(model);
    // System fields or relation table fields: direct access
    if (isSystemColumn(column) || model.mm) {
        const sysName = getSysColumnName(column.uidt);
        const columnName = sysName || column.column_name;
        return `${prefix}.${columnName}`;
    }
    // User fields: use JSONB ->> operator
    return `${prefix}.data ->> '${column.column_name}'`;
}
/**
 * Get SQL column expression with type casting
 * @param column - Column definition
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @returns SQL column expression with cast
 */
function getSqlColumnNameWithCast(column, model, modelAlias) {
    const baseExpr = getSqlColumnName(column, model, modelAlias);
    // System columns don't need casting
    if (isSystemColumn(column) || model.mm) {
        return baseExpr;
    }
    // Cast based on column type
    switch (column.uidt) {
        case types_1.UITypes.Number:
        case types_1.UITypes.AutoNumber:
        case types_1.UITypes.Rating:
            return `CAST(${baseExpr} AS NUMERIC)`;
        case types_1.UITypes.Decimal:
        case types_1.UITypes.Currency:
        case types_1.UITypes.Percent:
            return `CAST(${baseExpr} AS DECIMAL)`;
        case types_1.UITypes.Checkbox:
            return `CAST(${baseExpr} AS BOOLEAN)`;
        case types_1.UITypes.Date:
            return `CAST(${baseExpr} AS DATE)`;
        case types_1.UITypes.DateTime:
        case types_1.UITypes.CreatedTime:
        case types_1.UITypes.LastModifiedTime:
            return `CAST(${baseExpr} AS TIMESTAMP)`;
        case types_1.UITypes.Time:
            return `CAST(${baseExpr} AS TIME)`;
        default:
            return baseExpr;
    }
}
// ========================================
// Column Access Helpers
// ========================================
/**
 * Get columns from a model
 * @param model - Table/model definition
 * @returns Array of columns
 */
function getColumns(model) {
    return model.columns || [];
}
/**
 * Get columns including default PK if not defined
 * @param model - Table/model definition
 * @returns Array of columns with PK
 */
function getColumnsIncludingPk(model) {
    const columns = getColumns(model);
    const pk = primaryKey(model);
    if (!pk) {
        return [types_1.ID_COLUMN, ...columns];
    }
    return columns;
}
/**
 * Get primary key column
 * @param model - Table/model definition
 * @returns Primary key column or undefined
 */
function primaryKey(model) {
    return getColumns(model).find((col) => col.pk);
}
/**
 * Get primary key column (throws if not found)
 * @param model - Table/model definition
 * @returns Primary key column
 */
function getPrimaryKeyMust(model) {
    const pk = primaryKey(model);
    if (!pk) {
        return types_1.ID_COLUMN;
    }
    return pk;
}
/**
 * Get column by ID
 * @param columnId - Column ID
 * @param model - Table/model definition
 * @returns Column or undefined
 */
function getColumnById(columnId, model) {
    return getColumnsIncludingPk(model).find((col) => col.id === columnId);
}
/**
 * Get column by name
 * @param columnName - Column name
 * @param model - Table/model definition
 * @returns Column or undefined
 */
function getColumnByName(columnName, model) {
    return getColumnsIncludingPk(model).find((col) => col.column_name === columnName || col.title === columnName);
}
/**
 * Get table by ID from models array
 * @param tableId - Table ID
 * @param models - Array of models
 * @returns Table or undefined
 */
function getTableById(tableId, models) {
    return models.find((m) => m.id === tableId);
}
/**
 * Get table by ID (throws if not found)
 * @param tableId - Table ID
 * @param models - Array of models
 * @returns Table
 */
function getTableByIdMust(tableId, models) {
    const table = getTableById(tableId, models);
    if (!table) {
        throw new Error(`Table with id '${tableId}' not found`);
    }
    return table;
}
// ========================================
// MM Relation Helpers
// ========================================
/**
 * Get child table ID from MM junction table
 * @param parentTableId - Parent table ID
 * @param mmTable - Junction table
 * @returns Child table ID
 */
function getChildTableIdFromMM(parentTableId, mmTable) {
    const columns = getColumns(mmTable);
    for (const col of columns) {
        if (col.uidt === types_1.UITypes.LinkToAnotherRecord) {
            const options = col.colOptions;
            if (options?.fk_related_model_id && options.fk_related_model_id !== parentTableId) {
                return options.fk_related_model_id;
            }
        }
    }
    // Fallback: look for fk_parent_id / fk_child_id patterns
    const fkParentCol = columns.find((c) => c.column_name === 'fk_parent_id');
    const fkChildCol = columns.find((c) => c.column_name === 'fk_child_id');
    if (fkChildCol && fkParentCol) {
        // Return child column's related model
        return fkChildCol.colOptions?.fk_related_model_id || '';
    }
    return '';
}
/**
 * Get MM column configuration
 * @param column - Link column
 * @returns Link options
 */
function getMMColumnConfig(column) {
    if (column.uidt !== types_1.UITypes.LinkToAnotherRecord) {
        return undefined;
    }
    return column.colOptions;
}
// ========================================
// Query Builder Factory
// ========================================
/**
 * Create a query builder for a model
 * @param dbDriver - Knex instance
 * @param model - Table/model definition
 * @param alias - Optional table alias
 * @returns Knex query builder
 */
function getQueryBuilder(dbDriver, model, alias) {
    const tableName = getSqlTableName(model);
    let query;
    if (alias) {
        query = dbDriver({ [alias]: tableName });
    }
    else {
        query = dbDriver(tableName);
    }
    // Filter by table_id (critical for data isolation)
    const tableAlias = alias || tableName;
    query.where(`${tableAlias}.fk_table_id`, model.id);
    return query;
}
/**
 * Create an insert query builder (without table_id filter)
 * @param dbDriver - Knex instance
 * @param model - Table/model definition
 * @returns Knex query builder for inserts
 */
function getInsertQueryBuilder(dbDriver, model) {
    const tableName = getSqlTableName(model);
    return dbDriver(tableName);
}
// ========================================
// Select Query Building
// ========================================
/**
 * Build column select expressions
 * @param columns - Columns to select
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @param dbDriver - Knex instance
 * @returns Array of select expressions
 */
function buildColumnSelects(columns, model, modelAlias, dbDriver) {
    const selects = [];
    for (const column of columns) {
        // Skip virtual columns (handled separately)
        if (isVirtualColumn(column)) {
            continue;
        }
        const sqlCol = getSqlColumnName(column, model, modelAlias);
        // For system columns, select directly
        if (isSystemColumn(column) || model.mm) {
            selects.push(`${sqlCol} as "${column.title || column.column_name}"`);
        }
        else {
            // For JSONB fields, use alias
            selects.push(dbDriver.raw(`${sqlCol} as ??`, [column.title || column.column_name]));
        }
    }
    return selects;
}
/**
 * Parse fields argument into column array
 * @param fields - Fields string or array
 * @param model - Table/model definition
 * @returns Array of columns to include
 */
function parseFields(fields, model) {
    const allColumns = getColumnsIncludingPk(model);
    if (!fields) {
        return allColumns;
    }
    const fieldList = Array.isArray(fields)
        ? fields
        : fields.split(',').map((f) => f.trim());
    if (fieldList.length === 0 || (fieldList.length === 1 && fieldList[0] === '*')) {
        return allColumns;
    }
    return allColumns.filter((col) => fieldList.includes(col.id) ||
        fieldList.includes(col.title) ||
        fieldList.includes(col.column_name));
}
// ========================================
// Pagination Helpers
// ========================================
/**
 * Apply pagination to query builder
 * @param qb - Query builder
 * @param limit - Limit
 * @param offset - Offset
 * @param config - Model config with limits
 */
function applyPagination(qb, limit, offset, config = { limitDefault: 25, limitMin: 1, limitMax: 1000 }) {
    // Apply limit with bounds
    const effectiveLimit = Math.min(Math.max(limit ?? config.limitDefault, config.limitMin), config.limitMax);
    qb.limit(effectiveLimit);
    // Apply offset if provided
    if (offset !== undefined && offset > 0) {
        qb.offset(offset);
    }
}
// ========================================
// Where Clause Helpers
// ========================================
/**
 * Build WHERE clause for primary key
 * @param model - Table/model definition
 * @param id - Primary key value
 * @param modelAlias - Optional table alias
 * @returns Object for Knex where clause
 */
function wherePk(model, id, modelAlias) {
    const pk = getPrimaryKeyMust(model);
    const prefix = modelAlias || getSqlTableName(model);
    const columnExpr = isSystemColumn(pk)
        ? `${prefix}.${pk.column_name}`
        : `${prefix}.id`; // Always use id column for PK
    return { [columnExpr]: id };
}
//# sourceMappingURL=queryBuilderHelper.js.map