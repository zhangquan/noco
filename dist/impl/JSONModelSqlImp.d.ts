import type { Knex } from 'knex';
import { AbstractLinkModelSql } from '../abstract/AbstractLinkModelSql';
import { CookieType, ListArgs, ModelConfig, RecordType, TableType, BulkOperationOptions } from '../interface/types';
/**
 * Main JSON-based model implementation
 * Implements all CRUD and link operations for JSONB storage
 */
export declare class JSONModelSqlImp extends AbstractLinkModelSql {
    constructor(params: {
        dbDriver: Knex;
        modelId: string;
        models: TableType[];
        viewId?: string;
        alias?: string;
        config?: Partial<ModelConfig>;
    });
    /**
     * Build SELECT query with support for virtual columns
     */
    buildSelectQuery(params: {
        qb: Knex.QueryBuilder;
        columns?: string | string[];
    }): Promise<Knex.QueryBuilder>;
    /**
     * Check if column type is virtual
     */
    private isVirtualColumnType;
    /**
     * Add virtual column to SELECT
     */
    private addVirtualColumnSelect;
    /**
     * Convert data before insert (type coercion)
     */
    protected convertDataBeforeInsert(model: TableType, data: RecordType): RecordType;
    /**
     * Insert with full data conversion
     */
    insert(data: RecordType, trx?: Knex.Transaction, cookie?: CookieType): Promise<RecordType>;
    /**
     * Update with merge support
     */
    updateByPk(id: string, data: RecordType, trx?: Knex.Transaction, cookie?: CookieType): Promise<RecordType>;
    /**
     * List records with virtual column support
     */
    list(args?: ListArgs, ignoreFilterSort?: boolean): Promise<RecordType[]>;
    /**
     * Bulk insert with transaction support
     */
    bulkInsert(datas: RecordType[], options?: BulkOperationOptions): Promise<RecordType[]>;
    private _bulkInsertInternal;
    /**
     * Bulk update with transaction support
     */
    bulkUpdate(datas: RecordType[], options?: BulkOperationOptions): Promise<RecordType[]>;
    private _bulkUpdateInternal;
    /**
     * Helper to chunk array
     */
    private chunkArray;
    /**
     * Read by PK with virtual columns
     */
    readByPk(id: string, fields?: string | string[]): Promise<RecordType | null>;
}
//# sourceMappingURL=JSONModelSqlImp.d.ts.map