import type { Knex } from 'knex';
import { AbstractBaseModelSql } from './AbstractBaseModelSql';
import type { LinkModelSql } from '../interface/LinkModelSql';
import { CookieType, ListArgs, RecordType } from '../interface/types';
/**
 * Abstract class implementing LinkModelSql interface
 * Provides many-to-many relationship functionality
 */
export declare abstract class AbstractLinkModelSql extends AbstractBaseModelSql implements LinkModelSql {
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
}
//# sourceMappingURL=AbstractLinkModelSql.d.ts.map