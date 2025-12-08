/**
 * Page Model
 * @module models/Page
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { Page as PageType } from '../types/index.js';
import { getDb, generateId } from '../db/index.js';
import { NocoCache } from '../cache/index.js';
import {
  getById,
  getByCondition,
  listRecords,
  updateRecord,
  deleteRecord,
  invalidateListCache,
  type TableOptions,
} from './Table.js';
import { Schema, type JsonPatchOperation, type SchemaPatchResult } from './Schema.js';

const CACHE_SCOPE = CacheScope.PAGE;
const META_TABLE = MetaTable.PAGES;

export class Page {
  private data: PageType;

  constructor(data: PageType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get groupId(): string | undefined { return this.data.group_id; }
  get title(): string { return this.data.title; }
  get route(): string | undefined { return this.data.route; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get order(): number { return this.data.order ?? 0; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): PageType { return this.data; }
  toJSON(): PageType { return { ...this.data }; }

  async update(data: Partial<Pick<PageType, 'title' | 'route' | 'order' | 'group_id' | 'fk_schema_id' | 'meta'>>): Promise<void> {
    await Page.update(this.id, data);
    const updated = await Page.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  // ==========================================================================
  // Schema Methods
  // ==========================================================================

  /**
   * Get Schema model instance (DEV environment)
   */
  async getSchemaModel(options?: TableOptions): Promise<Schema | null> {
    return Schema.getOrCreate({
      domain: 'page',
      fk_domain_id: this.id,
      fk_project_id: this.projectId,
      env: 'DEV',
    }, options);
  }

  /**
   * Get published Schema model instance (PRO environment)
   */
  async getPublicSchemaModel(options?: TableOptions): Promise<Schema | null> {
    return Schema.getByDomainAndEnv('page', this.id, 'PRO', options);
  }

  /**
   * Get schema data
   */
  async getSchemaData(options?: TableOptions): Promise<Record<string, unknown> | null> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) return null;
    
    // Update local reference
    if (this.data.fk_schema_id !== schemaModel.id) {
      this.data.fk_schema_id = schemaModel.id;
    }
    
    return schemaModel.data;
  }

  /**
   * Update schema using JSON Patch operations
   */
  async patchSchema(
    patches: JsonPatchOperation[],
    options?: TableOptions
  ): Promise<SchemaPatchResult> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      throw new Error('Schema not found for page');
    }
    return schemaModel.applyPatch(patches, options);
  }

  /**
   * Update schema data (full replace)
   */
  async updateSchemaData(
    data: Record<string, unknown>,
    options?: TableOptions
  ): Promise<Schema> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      // Create new schema
      const newSchema = await Schema.create({
        domain: 'page',
        fk_domain_id: this.id,
        fk_project_id: this.projectId,
        data,
        env: 'DEV',
      }, options);

      // Update page with schema reference
      await Page.update(this.id, { fk_schema_id: newSchema.id }, options);
      this.data.fk_schema_id = newSchema.id;
      return newSchema;
    }

    await schemaModel.updateData(data, options);
    return schemaModel;
  }

  /**
   * Publish schema (copy DEV to PRO)
   */
  async publishSchema(options?: TableOptions): Promise<Schema> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      throw new Error('No schema to publish');
    }

    const publishedSchema = await schemaModel.publish(options);

    // Update page with published schema reference
    await Page.update(this.id, { fk_publish_schema_id: publishedSchema.id }, options);
    this.data.fk_publish_schema_id = publishedSchema.id;

    return publishedSchema;
  }

  // Static methods
  static async get(id: string, options?: TableOptions): Promise<Page | null> {
    const data = await getById<PageType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Page(data) : null;
  }

  static async getByRoute(projectId: string, route: string, options?: TableOptions): Promise<Page | null> {
    const data = await getByCondition<PageType>(META_TABLE, { project_id: projectId, route }, options);
    return data ? new Page(data) : null;
  }

  static async insert(data: {
    project_id: string;
    title: string;
    route?: string;
    group_id?: string;
    fk_schema_id?: string;
    meta?: Record<string, unknown>;
  }, options?: TableOptions): Promise<Page> {
    const db = options?.knex || getDb();
    const now = new Date();
    const id = generateId();

    const route = data.route || '/' + data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const maxOrder = await db
      .from(META_TABLE)
      .where('project_id', data.project_id)
      .max('order as max')
      .first();

    const pageData: Partial<PageType> = {
      id,
      project_id: data.project_id,
      group_id: data.group_id,
      title: data.title,
      route,
      fk_schema_id: data.fk_schema_id,
      order: ((maxOrder as any)?.max || 0) + 1,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(META_TABLE).insert(pageData);
    
    const page = await this.get(id, { ...options, skipCache: true });
    if (!page) throw new Error('Failed to create page');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, page.getData());
      await cache.invalidateList(CACHE_SCOPE, data.project_id);
    }

    return page;
  }

  static async update(id: string, data: Partial<Pick<PageType, 'title' | 'route' | 'fk_schema_id' | 'fk_publish_schema_id' | 'order' | 'group_id' | 'meta'>>, options?: TableOptions): Promise<void> {
    const page = await this.get(id, options);
    await updateRecord<PageType>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (page && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, page.projectId);
    }
  }

  static async delete(id: string, options?: TableOptions): Promise<number> {
    const page = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (page && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, page.projectId);
    }
    return result;
  }

  static async listForProject(projectId: string, groupId?: string, options?: TableOptions): Promise<Page[]> {
    const condition: Record<string, unknown> = { project_id: projectId };
    if (groupId !== undefined) {
      condition.group_id = groupId;
    }

    const data = await listRecords<PageType>(
      CACHE_SCOPE,
      META_TABLE,
      groupId ? `${projectId}:${groupId}` : projectId,
      { condition, orderBy: { order: 'asc', created_at: 'asc' } },
      options
    );
    return data.map(d => new Page(d));
  }

  static async reorder(projectId: string, pageOrders: Array<{ id: string; order: number }>, options?: TableOptions): Promise<void> {
    const db = options?.knex || getDb();

    await db.transaction(async (trx) => {
      for (const { id, order } of pageOrders) {
        await trx(META_TABLE).where('id', id).update({ order, updated_at: new Date() });
      }
    });

    if (!options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, projectId);
      const cache = NocoCache.getInstance();
      for (const { id } of pageOrders) {
        await cache.del(`${CACHE_SCOPE}:${id}`);
      }
    }
  }

  static async moveToGroup(id: string, groupId: string | null, options?: TableOptions): Promise<void> {
    await this.update(id, { group_id: groupId || undefined }, options);
  }
}

export default Page;
