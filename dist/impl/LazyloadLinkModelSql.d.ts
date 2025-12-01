import type { Knex } from 'knex';
import { JSONModelSqlImp } from './JSONModelSqlImp';
import { ListArgs, RecordType, TableType, ModelConfig } from '../interface/types';
/**
 * Lazy loading link model implementation
 * Loads related data on demand rather than upfront
 */
export declare class LazyloadLinkModelSql extends JSONModelSqlImp {
    private _relationCache;
    constructor(params: {
        dbDriver: Knex;
        modelId: string;
        models: TableType[];
        viewId?: string;
        alias?: string;
        config?: Partial<ModelConfig>;
    });
    /**
     * Load related records for a single record lazily
     */
    loadRelated(record: RecordType, colId: string, args?: ListArgs): Promise<RecordType[]>;
    /**
     * Batch load related records for multiple records
     * More efficient than loading one by one
     */
    batchLoadRelated(records: RecordType[], colId: string, args?: ListArgs): Promise<Map<string, RecordType[]>>;
    /**
     * Clear relation cache
     */
    clearCache(colId?: string): void;
    /**
     * List records and optionally preload specific relations
     */
    listWithRelations(args: ListArgs & {
        preloadRelations?: string[];
    }): Promise<{
        records: RecordType[];
        relations: Map<string, Map<string, RecordType[]>>;
    }>;
    /**
     * Read by PK with lazy loading support
     */
    readByPkWithRelations(id: string, options?: {
        fields?: string | string[];
        loadRelations?: string[];
    }): Promise<{
        record: RecordType | null;
        relations: Map<string, RecordType[]>;
    }>;
    protected parseRow(row: RecordType): RecordType;
}
//# sourceMappingURL=LazyloadLinkModelSql.d.ts.map