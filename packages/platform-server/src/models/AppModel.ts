/**
 * AppModel - Application Model
 * @module models/AppModel
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { AppModel as AppModelType, AppType } from '../types/index.js';
import { getDb, generateId } from '../db/index.js';
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

const CACHE_SCOPE = CacheScope.APP;
const META_TABLE = MetaTable.APPS;

export class AppModel {
  private data: AppModelType;

  constructor(data: AppModelType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get title(): string { return this.data.title; }
  get type(): AppType { return this.data.type; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get order(): number { return this.data.order ?? 0; }
  get status(): 'active' | 'inactive' | 'archived' { return this.data.status ?? 'active'; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): AppModelType { return this.data; }
  toJSON(): AppModelType { return { ...this.data }; }

  async update(data: Partial<Pick<AppModelType, 'title' | 'order' | 'status' | 'meta' | 'fk_schema_id' | 'fk_publish_schema_id'>>): Promise<void> {
    await AppModel.update(this.id, data);
    const updated = await AppModel.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  async publish(): Promise<void> {
    await AppModel.publish(this.id);
    const updated = await AppModel.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  // Static methods
  static async get(id: string, options?: BaseModelOptions): Promise<AppModel | null> {
    const data = await getById<AppModelType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new AppModel(data) : null;
  }

  static async getByTitle(projectId: string, title: string, options?: BaseModelOptions): Promise<AppModel | null> {
    const data = await getByCondition<AppModelType>(META_TABLE, { project_id: projectId, title }, options);
    return data ? new AppModel(data) : null;
  }

  static async insert(data: {
    project_id: string;
    title: string;
    type: AppType;
    fk_schema_id?: string;
    meta?: Record<string, unknown>;
  }, options?: BaseModelOptions): Promise<AppModel> {
    const db = options?.knex || getDb();
    const now = new Date();
    const id = generateId();

    const maxOrder = await db
      .from(META_TABLE)
      .where('project_id', data.project_id)
      .max('order as max')
      .first();

    const appData: Partial<AppModelType> = {
      id,
      project_id: data.project_id,
      title: data.title,
      type: data.type,
      fk_schema_id: data.fk_schema_id,
      order: ((maxOrder as any)?.max || 0) + 1,
      status: 'active',
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(META_TABLE).insert(appData);
    
    const app = await this.get(id, { ...options, skipCache: true });
    if (!app) throw new Error('Failed to create app');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, app.getData());
      await cache.invalidateList(CACHE_SCOPE, data.project_id);
    }

    return app;
  }

  static async update(id: string, data: Partial<Pick<AppModelType, 'title' | 'fk_schema_id' | 'fk_publish_schema_id' | 'order' | 'status' | 'meta'>>, options?: BaseModelOptions): Promise<void> {
    const app = await this.get(id, options);
    await updateRecord<AppModelType>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (app && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, app.projectId);
    }
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const app = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (app && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, app.projectId);
    }
    return result;
  }

  static async listForProject(projectId: string, type?: AppType, options?: BaseModelOptions): Promise<AppModel[]> {
    const condition: Record<string, unknown> = { project_id: projectId };
    if (type) condition.type = type;

    const data = await listRecords<AppModelType>(
      CACHE_SCOPE,
      META_TABLE,
      type ? `${projectId}:${type}` : projectId,
      { condition, orderBy: { order: 'asc', created_at: 'asc' } },
      options
    );
    return data.map(d => new AppModel(d));
  }

  static async publish(id: string, options?: BaseModelOptions): Promise<void> {
    const app = await this.get(id, options);
    if (!app) throw new Error('App not found');
    if (!app.schemaId) throw new Error('App has no schema to publish');

    await this.update(id, { fk_publish_schema_id: app.schemaId }, options);
  }
}

export default AppModel;
