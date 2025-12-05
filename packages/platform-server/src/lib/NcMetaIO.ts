/**
 * NcMetaIO - Metadata Database Interface
 * @module lib/NcMetaIO
 */

import type { Knex } from 'knex';
import { ulid } from 'ulid';
import { MetaTable } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface MetaGetOptions {
  condition?: Record<string, unknown>;
  conditionArr?: Array<{ key: string; value: unknown; op?: string }>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  xcCondition?: Record<string, unknown>;
}

export interface MetaInsertOptions {
  ignoreIdGeneration?: boolean;
}

// ============================================================================
// NcMetaIO Class
// ============================================================================

export class NcMetaIO {
  protected db: Knex;
  protected dbType: 'pg' | 'mysql' | 'sqlite';

  constructor(db: Knex, dbType: 'pg' | 'mysql' | 'sqlite' = 'pg') {
    this.db = db;
    this.dbType = dbType;
  }

  getKnex(): Knex {
    return this.db;
  }

  genNanoid(prefix?: string): string {
    const id = ulid();
    return prefix ? `${prefix}_${id}` : id;
  }

  // CRUD Operations
  async metaInsert(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    data: Record<string, unknown>,
    options?: MetaInsertOptions
  ): Promise<string> {
    const insertData = { ...data };
    if (!options?.ignoreIdGeneration && !insertData.id) {
      insertData.id = this.genNanoid();
    }
    const now = new Date();
    if (!insertData.created_at) insertData.created_at = now;
    if (!insertData.updated_at) insertData.updated_at = now;

    await this.db(target).insert(insertData);
    return insertData.id as string;
  }

  async metaInsertAll(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    data: Record<string, unknown>[]
  ): Promise<string[]> {
    const ids: string[] = [];
    const now = new Date();

    const insertData = data.map(record => {
      const id = (record.id as string) || this.genNanoid();
      ids.push(id);
      return { ...record, id, created_at: record.created_at || now, updated_at: record.updated_at || now };
    });

    if (insertData.length > 0) {
      await this.db.batchInsert(target, insertData, 100);
    }

    return ids;
  }

  async metaGet2(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    idOrCondition: string | Record<string, unknown>,
    fields?: string[]
  ): Promise<Record<string, unknown> | null> {
    let query = this.db(target);
    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }
    if (fields?.length) {
      query = query.select(fields);
    }
    const result = await query.first();
    return result || null;
  }

  async metaList(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    options?: MetaGetOptions
  ): Promise<Record<string, unknown>[]> {
    let query = this.db(target);

    if (options?.condition) {
      query = query.where(options.condition);
    }

    if (options?.conditionArr) {
      for (const cond of options.conditionArr) {
        const op = cond.op || '=';
        if (op === 'is') {
          if (cond.value === null) {
            query = query.whereNull(cond.key);
          } else {
            query = query.where(cond.key, cond.value as any);
          }
        } else if (op === 'is not') {
          if (cond.value === null) {
            query = query.whereNotNull(cond.key);
          } else {
            query = query.whereNot(cond.key, cond.value as any);
          }
        } else if (op === 'in' && Array.isArray(cond.value)) {
          query = query.whereIn(cond.key, cond.value as any[]);
        } else if (op === 'like') {
          query = query.where(cond.key, 'like', cond.value as string);
        } else {
          query = query.where(cond.key, op, cond.value as any);
        }
      }
    }

    if (options?.xcCondition) {
      query = this.applyXcCondition(query, options.xcCondition);
    }

    if (options?.orderBy) {
      for (const [col, dir] of Object.entries(options.orderBy)) {
        query = query.orderBy(col, dir);
      }
    }

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);

    return query;
  }

  async metaUpdate(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    data: Record<string, unknown>,
    idOrCondition: string | Record<string, unknown>,
    xcCondition?: Record<string, unknown>
  ): Promise<number> {
    const updateData = { ...data, updated_at: new Date() };
    let query = this.db(target);

    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }

    if (xcCondition) {
      query = this.applyXcCondition(query, xcCondition);
    }

    return query.update(updateData);
  }

  async metaDelete(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    idOrCondition: string | Record<string, unknown>,
    xcCondition?: Record<string, unknown>
  ): Promise<number> {
    let query = this.db(target);

    if (typeof idOrCondition === 'string') {
      query = query.where('id', idOrCondition);
    } else {
      query = query.where(idOrCondition);
    }

    if (xcCondition) {
      query = this.applyXcCondition(query, xcCondition);
    }

    return query.delete();
  }

  async metaDeleteAll(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    condition?: Record<string, unknown>
  ): Promise<number> {
    let query = this.db(target);
    if (condition) query = query.where(condition);
    return query.delete();
  }

  async metaCount(
    projectId: string | null,
    baseId: string | null,
    target: MetaTable,
    condition?: Record<string, unknown>
  ): Promise<number> {
    let query = this.db(target);
    if (condition) query = query.where(condition);
    const result = await query.count({ count: '*' }).first();
    return Number(result?.count || 0);
  }

  // Transaction Support
  async transaction<T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  withTransaction(trx: Knex.Transaction): NcMetaIO {
    return new NcMetaIO(trx as unknown as Knex, this.dbType);
  }

  // Schema Operations
  async tableExists(tableName: string): Promise<boolean> {
    return this.db.schema.hasTable(tableName);
  }

  async raw<T = unknown>(sql: string, bindings?: unknown[]): Promise<T> {
    const result = await this.db.raw(sql, bindings || []);
    return result as T;
  }

  // Helper Methods
  protected applyXcCondition(
    query: Knex.QueryBuilder,
    xcCondition: Record<string, unknown>
  ): Knex.QueryBuilder {
    if (xcCondition._and) {
      query = query.where((qb) => {
        for (const cond of xcCondition._and as Record<string, unknown>[]) {
          this.applyXcCondition(qb, cond);
        }
      });
    }

    if (xcCondition._or) {
      query = query.where((qb) => {
        let first = true;
        for (const cond of xcCondition._or as Record<string, unknown>[]) {
          if (first) {
            this.applyXcCondition(qb, cond);
            first = false;
          } else {
            qb.orWhere((innerQb) => {
              this.applyXcCondition(innerQb, cond);
            });
          }
        }
      });
    }

    for (const [key, value] of Object.entries(xcCondition)) {
      if (key.startsWith('_')) continue;
      if (value === null) {
        query = query.whereNull(key);
      } else if (typeof value === 'object' && value !== null) {
        const condition = value as Record<string, unknown>;
        if (condition.eq !== undefined) query = query.where(key, condition.eq as any);
        if (condition.neq !== undefined) query = query.whereNot(key, condition.neq as any);
        if (condition.like !== undefined) query = query.where(key, 'like', condition.like as string);
        if (condition.gt !== undefined) query = query.where(key, '>', condition.gt as any);
        if (condition.gte !== undefined) query = query.where(key, '>=', condition.gte as any);
        if (condition.lt !== undefined) query = query.where(key, '<', condition.lt as any);
        if (condition.lte !== undefined) query = query.where(key, '<=', condition.lte as any);
        if (condition.in !== undefined && Array.isArray(condition.in)) {
          query = query.whereIn(key, condition.in as any[]);
        }
      } else {
        query = query.where(key, value as any);
      }
    }

    return query;
  }
}

// Singleton Instance
let ncMetaInstance: NcMetaIO | null = null;

export function initNcMeta(db: Knex, dbType?: 'pg' | 'mysql' | 'sqlite'): NcMetaIO {
  ncMetaInstance = new NcMetaIO(db, dbType);
  return ncMetaInstance;
}

export function getNcMeta(): NcMetaIO {
  if (!ncMetaInstance) {
    throw new Error('NcMetaIO not initialized. Call initNcMeta first.');
  }
  return ncMetaInstance;
}

export default NcMetaIO;
