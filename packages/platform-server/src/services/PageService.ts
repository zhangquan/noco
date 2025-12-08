/**
 * Page Service
 * Business logic for page management
 * @module services/PageService
 */

import { BaseService, type ServiceOptions } from './BaseService.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Page } from '../types/index.js';
import { NotFoundError } from '../errors/index.js';
import { ProjectService } from './ProjectService.js';

// ============================================================================
// Types
// ============================================================================

export interface CreatePageInput {
  project_id: string;
  title: string;
  route?: string;
  group_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdatePageInput {
  title?: string;
  route?: string;
  order?: number;
  group_id?: string | null;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

export interface ReorderItem {
  id: string;
  order: number;
}

// ============================================================================
// Page Service Class
// ============================================================================

class PageServiceImpl extends BaseService<Page> {
  protected tableName = MetaTable.PAGES;
  protected cacheScope = CacheScope.PAGE;
  protected entityName = 'Page';

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * List pages for a project
   */
  async listForProject(projectId: string, groupId?: string, options?: ServiceOptions): Promise<Page[]> {
    const where: Record<string, unknown> = { project_id: projectId };
    
    if (groupId !== undefined) {
      where.group_id = groupId || null;
    }

    return this.findMany({
      ...options,
      where,
      orderBy: { order: 'asc', created_at: 'asc' },
    });
  }

  /**
   * Get page by route within a project
   */
  async getByRoute(projectId: string, route: string, options?: ServiceOptions): Promise<Page | null> {
    return this.findOne({ project_id: projectId, route }, options);
  }

  /**
   * Get page by route or throw
   */
  async getByRouteOrFail(projectId: string, route: string, options?: ServiceOptions): Promise<Page> {
    const page = await this.getByRoute(projectId, route, options);
    if (!page) {
      throw new NotFoundError('Page', `route:${route}`);
    }
    return page;
  }

  // ============================================================================
  // Page Management
  // ============================================================================

  /**
   * Create a new page
   */
  async createPage(input: CreatePageInput, options?: ServiceOptions): Promise<Page> {
    // Verify project exists
    await ProjectService.getByIdOrFail(input.project_id, options);

    // Generate route if not provided
    const route = input.route || this.generateRoute(input.title);

    // Get max order for the group
    const maxOrder = await this.getMaxOrder(input.project_id, input.group_id, options);

    return this.create({
      project_id: input.project_id,
      title: input.title.trim(),
      route,
      group_id: input.group_id,
      order: maxOrder + 1,
      meta: input.meta,
    } as Partial<Page>, options);
  }

  /**
   * Update a page
   */
  async updatePage(id: string, input: UpdatePageInput, options?: ServiceOptions): Promise<Page> {
    const updateData: Partial<Page> = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.route !== undefined) updateData.route = input.route;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.group_id !== undefined) updateData.group_id = input.group_id || undefined;
    if (input.fk_schema_id !== undefined) updateData.fk_schema_id = input.fk_schema_id;
    if (input.meta !== undefined) updateData.meta = input.meta;

    return this.update(id, updateData, options);
  }

  /**
   * Save page (update meta/schema)
   */
  async savePage(
    id: string,
    input: { title?: string; route?: string; meta?: Record<string, unknown> },
    options?: ServiceOptions
  ): Promise<Page> {
    const updateData: Partial<Page> = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.route !== undefined) updateData.route = input.route;
    if (input.meta !== undefined) updateData.meta = input.meta;

    return this.update(id, updateData, options);
  }

  /**
   * Delete a page
   */
  async deletePage(id: string, options?: ServiceOptions): Promise<boolean> {
    return this.delete(id, options);
  }

  /**
   * Duplicate a page
   */
  async duplicate(id: string, newTitle?: string, options?: ServiceOptions): Promise<Page> {
    const page = await this.getByIdOrFail(id, options);

    const title = newTitle || `${page.title} (Copy)`;
    const route = this.generateRoute(title);
    const maxOrder = await this.getMaxOrder(page.project_id, page.group_id, options);

    return this.create({
      project_id: page.project_id,
      title,
      route,
      group_id: page.group_id,
      order: maxOrder + 1,
      meta: page.meta,
    } as Partial<Page>, options);
  }

  /**
   * Reorder pages
   */
  async reorder(projectId: string, orders: ReorderItem[], options?: ServiceOptions): Promise<void> {
    const db = this.getDb(options);

    await db.transaction(async (trx) => {
      for (const item of orders) {
        await trx(this.tableName)
          .where('id', item.id)
          .where('project_id', projectId)
          .update({ order: item.order, updated_at: new Date() });
      }
    });

    // Invalidate cache
    await this.invalidateListCache(`project:${projectId}`);
  }

  /**
   * Move page to a group
   */
  async moveToGroup(id: string, groupId: string | null, options?: ServiceOptions): Promise<Page> {
    const page = await this.getByIdOrFail(id, options);
    
    // Get max order in target group
    const maxOrder = await this.getMaxOrder(page.project_id, groupId || undefined, options);

    return this.update(id, {
      group_id: groupId || undefined,
      order: maxOrder + 1,
    } as Partial<Page>, options);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a URL-safe route from title
   */
  private generateRoute(title: string): string {
    return '/' + title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get maximum order value for pages in a project/group
   */
  private async getMaxOrder(
    projectId: string,
    groupId?: string,
    options?: ServiceOptions
  ): Promise<number> {
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
export const PageService = new PageServiceImpl();

export default PageService;
