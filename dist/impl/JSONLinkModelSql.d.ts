import type { Knex } from 'knex';
import type { LinkModelSql } from '../interface/LinkModelSql';
import { CookieType, ListArgs, RecordType, TableType, ModelConfig } from '../interface/types';
/**
 * Independent Link Model implementation
 * Does not extend AbstractBaseModelSql - implements interfaces directly
 * Useful for scenarios where only link operations are needed
 */
export declare class JSONLinkModelSql implements LinkModelSql {
    protected _dbDriver: Knex;
    protected _modelId: string;
    protected _viewId?: string;
    protected _models: TableType[];
    protected _model: TableType;
    protected _alias?: string;
    protected _config: ModelConfig;
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
    mmList(params: {
        colId: string;
        parentRowId: string;
    }, args?: ListArgs): Promise<RecordType[]>;
    mmListCount(params: {
        colId: string;
        parentRowId: string;
    }): Promise<number>;
    getMmChildrenExcludedList(params: {
        colId: string;
        parentRowId: string;
    }, args?: ListArgs): Promise<RecordType[]>;
    getMmChildrenExcludedListCount(params: {
        colId: string;
        parentRowId: string;
    }, args?: ListArgs): Promise<number>;
    hasChild(params: {
        colId: string;
        parentRowId: string;
        childRowId: string;
        cookie?: CookieType;
    }): Promise<boolean>;
    addChild(params: {
        colId: string;
        rowId: string;
        childId: string;
        cookie?: CookieType;
        trx?: Knex.Transaction;
    }): Promise<boolean>;
    removeChild(params: {
        colId: string;
        rowId: string;
        childId: string;
        cookie?: CookieType;
        trx?: Knex.Transaction;
    }): Promise<boolean>;
    /**
     * Add multiple children at once
     */
    addChildren(params: {
        colId: string;
        rowId: string;
        childIds: string[];
        cookie?: CookieType;
        trx?: Knex.Transaction;
    }): Promise<number>;
    /**
     * Remove multiple children at once
     */
    removeChildren(params: {
        colId: string;
        rowId: string;
        childIds: string[];
        cookie?: CookieType;
        trx?: Knex.Transaction;
    }): Promise<number>;
    mmSubQueryBuild(mainTable: {
        id: string;
    }, mmTable: {
        id: string;
    }, parentRowId?: string, limit?: number, offset?: number): Knex.QueryBuilder;
    mmCountSubQueryBuild(mainTable: {
        id: string;
    }, mmTable: {
        id: string;
    }, parentRowId: string): Knex.QueryBuilder;
    private getMMTablesForColumn;
    private buildChildSelectQuery;
    protected parseRow(row: RecordType): RecordType;
    protected extractRawQueryAndExec<T = RecordType[]>(qb: Knex.QueryBuilder): Promise<T>;
}
//# sourceMappingURL=JSONLinkModelSql.d.ts.map