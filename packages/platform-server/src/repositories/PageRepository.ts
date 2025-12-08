/**
 * Page Repository
 * Data access layer for page operations
 * @module repositories/PageRepository
 */

import { BaseRepository, type RepositoryOptions } from './BaseRepository.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Page } from '../types/index.js';
import { generateId, getDb } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PageRecord extends Page {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePageData {
  project_id: string;
  title: string;
  route?: string;
  group_id?: string;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdatePageData {
  title?: string;
  route?: string;
  order?: number;
  group_id?: string | null;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Page Repository Class
// ============================================================================

class PageRepositoryImpl extends BaseRepository<PageRecord> {
  protected tableName = MetaTable.PAGES;
  protected cacheScope = CacheScope.PAGE;

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get page by route within a project
   */
  async getByRoute(projectId: string, route: string, options?: RepositoryOptions): Promise<PageRecord | null> {
    return this.findOne({ project_id: projectId, route }, options);
  }

  /**
   * List pages for a project
   */
  async listForProject(projectId: string, groupId?: string, options?: RepositoryOptions): Promise<PageRecord[]> {
    const condition: Record<string, unknown> = { project_id: projectId };

    if (groupId !== undefined) {
      condition.group_id = groupId || null;
    }

    return this.list(groupId ? `${projectId}:${groupId}` : projectId, {
      ...options,
      condition,
      orderBy: { order: 'asc', created_at: 'asc' },
    });
  }

  // ==========================================================================
  // Create / Update Operations
  // ==========================================================================

  /**
   * Create a new page
   */
  async createPage(data: CreatePageData, options?: RepositoryOptions): Promise<PageRecord> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    // Generate route if not provided
    const route = data.route || '/' + data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Get max order
    const maxOrder = await db
      .from(this.tableName)
      .where('project_id', data.project_id)
      .max('order as max')
      .first();

    const pageData: Partial<PageRecord> = {
      id,
      project_id: data.project_id,
      group_id: data.group_id,
      title: data.title.trim(),
      route,
      fk_schema_id: data.fk_schema_id,
      order: ((maxOrder as any)?.max || 0) + 1,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(this.tableName).insert(pageData);

    const page = await this.getById(id, { ...options, skipCache: true });
    if (!page) throw new Error('Failed to create page');

    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), page);
      await cache.invalidateList(this.cacheScope, data.project_id);
    }

    return page;
  }

  /**
   * Update a page
   */
  async updatePage(id: string, data: UpdatePageData, options?: RepositoryOptions): Promise<void> {
    const page = await this.getById(id, options);
    const updateData: Partial<PageRecord> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.route !== undefined) updateData.route = data.route;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.group_id !== undefined) updateData.group_id = data.group_id === null ? undefined : data.group_id;
    if (data.fk_schema_id !== undefined) updateData.fk_schema_id = data.fk_schema_id;
    if (data.fk_publish_schema_id !== undefined) updateData.fk_publish_schema_id = data.fk_publish_schema_id;
    if (data.meta !== undefined) updateData.meta = data.meta;

    await this.update(id, updateData, options);

    if (page && !options?.skipCache) {
      await this.invalidateListCache(page.project_id);
    }
  }

  /**
   * Delete a page
   */
  async deletePage(id: string, options?: RepositoryOptions): Promise<number> {
    const page = await this.getById(id, options);
    const result = await this.delete(id, options);

    if (page && !options?.skipCache) {
      await this.invalidateListCache(page.project_id);
    }

    return result;
  }

  /**
   * Reorder pages
   */
  async reorder(
    projectId: string,
    pageOrders: Array<{ id: string; order: number }>,
    options?: RepositoryOptions
  ): Promise<void> {
    const db = this.getDb(options);

    await db.transaction(async (trx) => {
      for (const { id, order } of pageOrders) {
        await trx(this.tableName).where('id', id).update({ order, updated_at: new Date() });
      }
    });

    if (!options?.skipCache) {
      await this.invalidateListCache(projectId);
      const cache = this.getCache();
      for (const { id } of pageOrders) {
        await cache.del(this.getCacheKey(id));
      }
    }
  }

  /**
   * Get max order for pages in a project/group
   */
  async getMaxOrder(projectId: string, groupId?: string, options?: RepositoryOptions): Promise<number> {
    const db = this.getDb(options);

    let query = db(this.tableName)
      .max('order as maxOrder')
      .where('project_id', projectId);

    if (groupId) {
      query = query.where('group_id', groupId);
    } else {
      query = query.whereNull('group_id');
    }

    const result = await query.first();
    return result?.maxOrder ?? 0;
  }
}

// Export singleton instance
export const PageRepository = new PageRepositoryImpl();

export default PageRepository;
