import type { Knex } from 'knex';
import { JSONModelSqlImp } from './JSONModelSqlImp';
import { RecordType, TableType, ModelConfig, CookieType } from '../interface/types';
/**
 * Options for copy operations
 */
export interface CopyOptions {
    /** Copy linked records as well */
    copyRelations?: boolean;
    /** Deep copy (follow all links) */
    deepCopy?: boolean;
    /** Maximum depth for deep copy */
    maxDepth?: number;
    /** Fields to exclude from copy */
    excludeFields?: string[];
    /** Custom field transformers */
    transformers?: Record<string, (value: any) => any>;
    /** Transaction to use */
    trx?: Knex.Transaction;
    /** Cookie/context */
    cookie?: CookieType;
}
/**
 * Copy result
 */
export interface CopyResult {
    /** Original record ID */
    originalId: string;
    /** New record ID */
    newId: string;
    /** The copied record */
    record: RecordType;
    /** Copied relation IDs */
    copiedRelations?: Map<string, string[]>;
}
/**
 * Data copy implementation
 * Provides functionality to copy records and their relationships
 */
export declare class CopySqlImp extends JSONModelSqlImp {
    constructor(params: {
        dbDriver: Knex;
        modelId: string;
        models: TableType[];
        viewId?: string;
        alias?: string;
        config?: Partial<ModelConfig>;
    });
    /**
     * Copy a single record
     */
    copyRecord(id: string, options?: CopyOptions): Promise<CopyResult>;
    /**
     * Copy multiple records
     */
    copyRecords(ids: string[], options?: CopyOptions): Promise<CopyResult[]>;
    /**
     * Copy an entire table's data
     */
    copyTable(sourceTableId: string, targetTableId: string, options?: CopyOptions): Promise<{
        copiedCount: number;
        idMapping: Map<string, string>;
    }>;
    /**
     * Copy all MM relations for a record
     */
    private copyRelations;
    /**
     * Deep copy - copy record and all linked records recursively
     */
    deepCopy(id: string, options?: CopyOptions): Promise<{
        root: CopyResult;
        all: Map<string, CopyResult>;
    }>;
    private deepCopyRecursive;
    /**
     * Prepare copy data by excluding fields and applying transformers
     */
    private prepareCopyData;
    private parseRowInternal;
}
//# sourceMappingURL=CopySqlImp.d.ts.map