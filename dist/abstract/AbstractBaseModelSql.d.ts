import type { Knex } from 'knex';
import type { BaseModelSql } from '../interface/BaseModelSql';
import { ColumnType, CookieType, GroupByArgs, ListArgs, ModelConfig, RecordType, TableType, BulkOperationOptions } from '../interface/types';
/**
 * Abstract base class implementing BaseModelSql interface
 * Provides core CRUD functionality for JSON-based storage
 */
export declare abstract class AbstractBaseModelSql implements BaseModelSql {
    protected _dbDriver: Knex;
    protected _modelId: string;
    protected _viewId?: string;
    protected _models: TableType[];
    protected _model: TableType;
    protected _alias?: string;
    protected _config: ModelConfig;
    protected _columnCache: Map<string, ColumnType>;
    constructor(params: {
        dbDriver: Knex;
        modelId: string;
        models: TableType[];
        viewId?: string;
        alias?: string;
        config?: Partial<ModelConfig>;
    });
    get dbDriver(): Knex;
    get modelId(): string;
    get viewId(): string | undefined;
    get models(): TableType[];
    get model(): TableType;
    get alias(): string | undefined;
    get config(): ModelConfig;
    getQueryBuilder(): Knex.QueryBuilder;
    getInsertQueryBuilder(): Knex.QueryBuilder;
    getSqlTableName(useAlias?: boolean): string;
    getSqlColumnName(column: ColumnType, model?: TableType): string;
    buildSelectQuery(params: {
        qb: Knex.QueryBuilder;
        columns?: string | string[];
    }): Promise<Knex.QueryBuilder>;
    applySortAndFilter(qb: Knex.QueryBuilder, args: ListArgs): Promise<Knex.QueryBuilder>;
    extractRawQueryAndExec<T = RecordType[]>(qb: Knex.QueryBuilder, driver?: Knex): Promise<T>;
    /**
     * Parse a row from database, handling JSONB data
     */
    protected parseRow(row: RecordType): RecordType;
    /**
     * Map field aliases to column names and separate system/user fields
     */
    mapAliasToColumn(data: RecordType, isUpdate?: boolean): {
        system: RecordType;
        data: RecordType;
    };
    /**
     * Convert value based on column type
     */
    protected convertValueForColumn(column: ColumnType, value: any): any;
    /**
     * Populate primary key if not provided
     */
    protected populatePk(data: RecordType): void;
    /**
     * Add bigtable-specific fields for insert
     */
    protected addBigtableDataForInsert(mapped: {
        system: RecordType;
        data: RecordType;
    }, cookie?: CookieType): RecordType;
    /**
     * Add bigtable-specific fields for update
     */
    protected addBigtableDataForUpdate(mapped: {
        system: RecordType;
        data: RecordType;
    }, cookie?: CookieType): RecordType;
    /**
     * Build WHERE clause for primary key
     */
    protected _wherePk(id: string): Record<string, string>;
    validate(columns: ColumnType[]): Promise<boolean>;
    readByPk(id: string, fields?: string | string[]): Promise<RecordType | null>;
    exist(id: string): Promise<boolean>;
    findOne(args: ListArgs): Promise<RecordType | null>;
    insert(data: RecordType, trx?: Knex.Transaction, cookie?: CookieType): Promise<RecordType>;
    updateByPk(id: string, data: RecordType, trx?: Knex.Transaction, cookie?: CookieType): Promise<RecordType>;
    delByPk(id: string, trx?: Knex.Transaction, cookie?: CookieType): Promise<number>;
    list(args?: ListArgs, ignoreFilterSort?: boolean): Promise<RecordType[]>;
    count(args?: ListArgs, ignoreFilterSort?: boolean): Promise<number>;
    bulkInsert(datas: RecordType[], options?: BulkOperationOptions): Promise<RecordType[]>;
    bulkUpdate(datas: RecordType[], options?: BulkOperationOptions): Promise<RecordType[]>;
    bulkUpdateAll(args: ListArgs, data: RecordType, options?: BulkOperationOptions): Promise<number>;
    bulkDelete(ids: string[], options?: BulkOperationOptions): Promise<number>;
    bulkDeleteAll(args?: ListArgs, options?: BulkOperationOptions): Promise<number>;
    groupBy(args: GroupByArgs): Promise<RecordType[]>;
    groupByV2(args: GroupByArgs): Promise<RecordType[]>;
}
//# sourceMappingURL=AbstractBaseModelSql.d.ts.map