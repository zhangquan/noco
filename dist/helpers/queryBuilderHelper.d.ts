import type { Knex } from 'knex';
import { ColumnType, TableType, UITypes, LinkToAnotherRecordOptionType } from '../interface/types';
/**
 * Main data table name
 */
export declare const NC_BIGTABLE = "nc_bigtable";
/**
 * Relations table name
 */
export declare const NC_BIGTABLE_RELATIONS = "nc_bigtable_relations";
/**
 * Get SQL table name for a model
 * @param model - Table/model definition
 * @param modelAlias - Optional alias
 * @returns SQL table name
 */
export declare function getSqlTableName(model: TableType, modelAlias?: string): string;
/**
 * Get table name with alias for query
 * @param model - Table/model definition
 * @param alias - Alias to use
 * @returns Object with table name and alias for Knex
 */
export declare function getTableWithAlias(model: TableType, alias: string): Record<string, string>;
/**
 * Check if a column is a system column
 * @param column - Column definition
 * @returns True if system column
 */
export declare function isSystemColumn(column: ColumnType): boolean;
/**
 * Check if a column is a virtual column (computed)
 * @param column - Column definition
 * @returns True if virtual column
 */
export declare function isVirtualColumn(column: ColumnType): boolean;
/**
 * Get system column name for a UI type
 * @param uidt - UI type
 * @returns System column name or null
 */
export declare function getSysColumnName(uidt: UITypes): string | null;
/**
 * Get SQL column expression for a column
 * @param column - Column definition
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @returns SQL column expression
 */
export declare function getSqlColumnName(column: ColumnType, model: TableType, modelAlias?: string): string;
/**
 * Get SQL column expression with type casting
 * @param column - Column definition
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @returns SQL column expression with cast
 */
export declare function getSqlColumnNameWithCast(column: ColumnType, model: TableType, modelAlias?: string): string;
/**
 * Get columns from a model
 * @param model - Table/model definition
 * @returns Array of columns
 */
export declare function getColumns(model: TableType): ColumnType[];
/**
 * Get columns including default PK if not defined
 * @param model - Table/model definition
 * @returns Array of columns with PK
 */
export declare function getColumnsIncludingPk(model: TableType): ColumnType[];
/**
 * Get primary key column
 * @param model - Table/model definition
 * @returns Primary key column or undefined
 */
export declare function primaryKey(model: TableType): ColumnType | undefined;
/**
 * Get primary key column (throws if not found)
 * @param model - Table/model definition
 * @returns Primary key column
 */
export declare function getPrimaryKeyMust(model: TableType): ColumnType;
/**
 * Get column by ID
 * @param columnId - Column ID
 * @param model - Table/model definition
 * @returns Column or undefined
 */
export declare function getColumnById(columnId: string, model: TableType): ColumnType | undefined;
/**
 * Get column by name
 * @param columnName - Column name
 * @param model - Table/model definition
 * @returns Column or undefined
 */
export declare function getColumnByName(columnName: string, model: TableType): ColumnType | undefined;
/**
 * Get table by ID from models array
 * @param tableId - Table ID
 * @param models - Array of models
 * @returns Table or undefined
 */
export declare function getTableById(tableId: string, models: TableType[]): TableType | undefined;
/**
 * Get table by ID (throws if not found)
 * @param tableId - Table ID
 * @param models - Array of models
 * @returns Table
 */
export declare function getTableByIdMust(tableId: string, models: TableType[]): TableType;
/**
 * Get child table ID from MM junction table
 * @param parentTableId - Parent table ID
 * @param mmTable - Junction table
 * @returns Child table ID
 */
export declare function getChildTableIdFromMM(parentTableId: string, mmTable: TableType): string;
/**
 * Get MM column configuration
 * @param column - Link column
 * @returns Link options
 */
export declare function getMMColumnConfig(column: ColumnType): LinkToAnotherRecordOptionType | undefined;
/**
 * Create a query builder for a model
 * @param dbDriver - Knex instance
 * @param model - Table/model definition
 * @param alias - Optional table alias
 * @returns Knex query builder
 */
export declare function getQueryBuilder(dbDriver: Knex, model: TableType, alias?: string): Knex.QueryBuilder;
/**
 * Create an insert query builder (without table_id filter)
 * @param dbDriver - Knex instance
 * @param model - Table/model definition
 * @returns Knex query builder for inserts
 */
export declare function getInsertQueryBuilder(dbDriver: Knex, model: TableType): Knex.QueryBuilder;
/**
 * Build column select expressions
 * @param columns - Columns to select
 * @param model - Table/model definition
 * @param modelAlias - Optional table alias
 * @param dbDriver - Knex instance
 * @returns Array of select expressions
 */
export declare function buildColumnSelects(columns: ColumnType[], model: TableType, modelAlias: string | undefined, dbDriver: Knex): (string | Knex.Raw)[];
/**
 * Parse fields argument into column array
 * @param fields - Fields string or array
 * @param model - Table/model definition
 * @returns Array of columns to include
 */
export declare function parseFields(fields: string | string[] | undefined, model: TableType): ColumnType[];
/**
 * Apply pagination to query builder
 * @param qb - Query builder
 * @param limit - Limit
 * @param offset - Offset
 * @param config - Model config with limits
 */
export declare function applyPagination(qb: Knex.QueryBuilder, limit?: number, offset?: number, config?: {
    limitDefault: number;
    limitMin: number;
    limitMax: number;
}): void;
/**
 * Build WHERE clause for primary key
 * @param model - Table/model definition
 * @param id - Primary key value
 * @param modelAlias - Optional table alias
 * @returns Object for Knex where clause
 */
export declare function wherePk(model: TableType, id: string, modelAlias?: string): Record<string, string>;
//# sourceMappingURL=queryBuilderHelper.d.ts.map