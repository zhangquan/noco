/**
 * Database (Base) Model
 * @module models/Database
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { Database as DatabaseType, DatabaseType as DBType } from '../types/index.js';
import { getMetaDb, generateId } from '../db/index.js';
import { NocoCache } from '../cache/index.js';
import {
  getById,
  getByCondition,
  listRecords,
  updateRecord,
  deleteRecord,
  invalidateListCache,
  type BaseModelOptions,
} from './BaseModel.js';

const CACHE_SCOPE = CacheScope.BASE;
const META_TABLE = MetaTable.BASES;

function encryptConfig(config: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(config)).toString('base64');
}

function decryptConfig(encrypted: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(encrypted, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

export class Database {
  private data: DatabaseType;

  constructor(data: DatabaseType) {
    this.data = data;
  }

  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get alias(): string | undefined { return this.data.alias; }
  get type(): DBType { return this.data.type; }
  get isDefaultDataServerDb(): boolean { return this.data.is_default_data_server_db; }
  get isMeta(): boolean { return this.data.is_meta ?? false; }
  get enabled(): boolean { return this.data.enabled ?? true; }
  get order(): number { return this.data.order ?? 0; }

  getData(): DatabaseType { return this.data; }
  toJSON(): DatabaseType { return { ...this.data }; }

  getConfig(): Record<string, unknown> {
    if (!this.data.config) return {};
    return decryptConfig(this.data.config);
  }

  getKnexConfig(): Record<string, unknown> {
    return {
      client: this.type === 'pg' ? 'postgresql' : this.type,
      connection: this.getConfig(),
    };
  }

  async update(data: { alias?: string; enabled?: boolean; order?: number; config?: Record<string, unknown> }): Promise<void> {
    await Database.update(this.id, data);
    const updated = await Database.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  static async get(id: string, options?: BaseModelOptions): Promise<Database | null> {
    const data = await getById<DatabaseType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Database(data) : null;
  }

  static async getDefaultDataServerDb(projectId: string, options?: BaseModelOptions): Promise<Database | null> {
    const data = await getByCondition<DatabaseType>(META_TABLE, { project_id: projectId, is_default_data_server_db: true }, options);
    return data ? new Database(data) : null;
  }

  static async getBaseByModel(projectId: string, options?: BaseModelOptions): Promise<Database | null> {
    const defaultDb = await this.getDefaultDataServerDb(projectId, options);
    if (defaultDb) return defaultDb;

    const db = options?.knex || getMetaDb();
    const data = await db(META_TABLE)
      .where({ project_id: projectId, enabled: true })
      .first();
    return data ? new Database(data as unknown as DatabaseType) : null;
  }

  static async createBase(data: {
    project_id: string;
    type: DBType;
    config?: Record<string, unknown>;
    alias?: string;
    is_default_data_server_db?: boolean;
    is_meta?: boolean;
  }, options?: BaseModelOptions): Promise<Database> {
    const db = options?.knex || getMetaDb();
    const now = new Date();
    const id = generateId();

    const databaseData: Record<string, unknown> = {
      id,
      project_id: data.project_id,
      type: data.type,
      config: data.config ? encryptConfig(data.config) : undefined,
      alias: data.alias,
      is_default_data_server_db: data.is_default_data_server_db ?? false,
      is_meta: data.is_meta ?? false,
      enabled: true,
      order: 0,
      created_at: now,
      updated_at: now,
    };

    await db(META_TABLE).insert(databaseData);
    
    const database = await this.get(id, { ...options, skipCache: true });
    if (!database) throw new Error('Failed to create database');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, database.getData());
      await cache.invalidateList(CACHE_SCOPE, data.project_id);
    }

    return database;
  }

  static async update(id: string, data: { alias?: string; enabled?: boolean; order?: number; config?: Record<string, unknown> }, options?: BaseModelOptions): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.alias !== undefined) updateData.alias = data.alias;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.config) updateData.config = encryptConfig(data.config);
    
    await updateRecord<DatabaseType>(CACHE_SCOPE, META_TABLE, id, updateData as Partial<DatabaseType>, options);
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const database = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (database && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, database.projectId);
    }
    return result;
  }

  static async listForProject(projectId: string, options?: BaseModelOptions): Promise<Database[]> {
    const data = await listRecords<DatabaseType>(
      CACHE_SCOPE,
      META_TABLE,
      projectId,
      { condition: { project_id: projectId }, orderBy: { order: 'asc', created_at: 'asc' } },
      options
    );
    return data.map(d => new Database(d));
  }
}

export default Database;
