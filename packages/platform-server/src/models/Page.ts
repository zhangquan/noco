/**
 * Page Model
 * @module models/Page
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { Page as PageType } from '../types/index.js';
import { getNcMeta } from '../lib/NcMetaIO.js';
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

const CACHE_SCOPE = CacheScope.PAGE;
const META_TABLE = MetaTable.PAGES;

export class Page {
  private data: PageType;

  constructor(data: PageType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get appId(): string { return this.data.app_id; }
  get title(): string { return this.data.title; }
  get route(): string | undefined { return this.data.route; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get order(): number { return this.data.order ?? 0; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): PageType { return this.data; }
  toJSON(): PageType { return { ...this.data }; }

  async update(data: Partial<Pick<PageType, 'title' | 'route' | 'order' | 'fk_schema_id' | 'meta'>>): Promise<void> {
    await Page.update(this.id, data);
    const updated = await Page.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  // Static methods
  static async get(id: string, options?: BaseModelOptions): Promise<Page | null> {
    const data = await getById<PageType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Page(data) : null;
  }

  static async getByRoute(appId: string, route: string, options?: BaseModelOptions): Promise<Page | null> {
    const data = await getByCondition<PageType>(META_TABLE, { app_id: appId, route }, options);
    return data ? new Page(data) : null;
  }

  static async insert(data: {
    app_id: string;
    title: string;
    route?: string;
    fk_schema_id?: string;
    meta?: Record<string, unknown>;
  }, options?: BaseModelOptions): Promise<Page> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    const route = data.route || '/' + data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const maxOrder = await ncMeta.getKnex()
      .from(META_TABLE)
      .where('app_id', data.app_id)
      .max('order as max')
      .first();

    const pageData: Partial<PageType> = {
      app_id: data.app_id,
      title: data.title,
      route,
      fk_schema_id: data.fk_schema_id,
      order: ((maxOrder as any)?.max || 0) + 1,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, META_TABLE, pageData as Record<string, unknown>);
    const page = await this.get(id, { ...options, skipCache: true });
    if (!page) throw new Error('Failed to create page');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, page.getData());
      await cache.invalidateList(CACHE_SCOPE, data.app_id);
    }

    return page;
  }

  static async update(id: string, data: Partial<Pick<PageType, 'title' | 'route' | 'fk_schema_id' | 'fk_publish_schema_id' | 'order' | 'meta'>>, options?: BaseModelOptions): Promise<void> {
    const page = await this.get(id, options);
    await updateRecord<PageType>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (page && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, page.appId);
    }
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const page = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (page && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, page.appId);
    }
    return result;
  }

  static async listForApp(appId: string, options?: BaseModelOptions): Promise<Page[]> {
    const data = await listRecords<PageType>(
      CACHE_SCOPE,
      META_TABLE,
      appId,
      { condition: { app_id: appId }, orderBy: { order: 'asc', created_at: 'asc' } },
      options
    );
    return data.map(d => new Page(d));
  }

  static async reorder(appId: string, pageOrders: Array<{ id: string; order: number }>, options?: BaseModelOptions): Promise<void> {
    const ncMeta = options?.ncMeta || getNcMeta();

    await ncMeta.transaction(async (trx) => {
      const trxMeta = ncMeta.withTransaction(trx);
      for (const { id, order } of pageOrders) {
        await trxMeta.metaUpdate(null, null, META_TABLE, { order }, id);
      }
    });

    if (!options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, appId);
      const cache = NocoCache.getInstance();
      for (const { id } of pageOrders) {
        await cache.del(`${CACHE_SCOPE}:${id}`);
      }
    }
  }
}

export default Page;
