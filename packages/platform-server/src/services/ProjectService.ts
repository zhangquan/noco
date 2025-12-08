/**
 * Project Service
 * Business logic for project management
 * @module services/ProjectService
 */

import type { Knex } from 'knex';
import { BaseService, type ServiceOptions, type PaginatedResult } from './BaseService.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Project, ProjectUser, ProjectRole } from '../types/index.js';
import { Errors, NotFoundError, ConflictError, AuthorizationError } from '../errors/index.js';
import { generateId } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateProjectInput {
  title: string;
  prefix?: string;
  description?: string;
  org_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  order?: number;
  color?: string;
  meta?: Record<string, unknown>;
}

export interface ProjectWithRole extends Project {
  role?: ProjectRole;
}

export interface ProjectUserInfo extends ProjectUser {
  email: string;
  firstname?: string;
  lastname?: string;
}

// ============================================================================
// Project Service Class
// ============================================================================

class ProjectServiceImpl extends BaseService<Project> {
  protected tableName = MetaTable.PROJECTS;
  protected cacheScope = CacheScope.PROJECT;
  protected entityName = 'Project';

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get project by title
   */
  async getByTitle(title: string, options?: ServiceOptions): Promise<Project | null> {
    return this.findOne({ title, deleted: false }, options);
  }

  /**
   * List all non-deleted projects
   */
  async listAll(options?: ServiceOptions): Promise<Project[]> {
    return this.findMany({
      ...options,
      where: { deleted: false },
      orderBy: { order: 'asc', created_at: 'desc' },
    });
  }

  /**
   * List projects for a specific user
   */
  async listForUser(userId: string, options?: ServiceOptions): Promise<ProjectWithRole[]> {
    const cache = this.getCache();
    const cacheKey = `projects:user:${userId}`;

    if (!options?.skipCache) {
      const cached = await cache.get<ProjectWithRole[]>(cacheKey);
      if (cached) return cached;
    }

    const db = this.getDb(options);
    const results = await db
      .select('p.*', 'pu.roles as role')
      .from(`${this.tableName} as p`)
      .join(`${MetaTable.PROJECT_USERS} as pu`, 'p.id', 'pu.project_id')
      .where('pu.user_id', userId)
      .where('p.deleted', false)
      .orderBy('pu.order', 'asc')
      .orderBy('p.created_at', 'desc');

    if (!options?.skipCache) {
      await cache.set(cacheKey, results, 300);
    }

    return results as ProjectWithRole[];
  }

  /**
   * Get paginated list of projects for user
   */
  async listForUserPaginated(
    userId: string,
    page: number = 1,
    pageSize: number = 25,
    options?: ServiceOptions
  ): Promise<PaginatedResult<ProjectWithRole>> {
    const db = this.getDb(options);
    const offset = (page - 1) * pageSize;

    const [results, countResult] = await Promise.all([
      db
        .select('p.*', 'pu.roles as role')
        .from(`${this.tableName} as p`)
        .join(`${MetaTable.PROJECT_USERS} as pu`, 'p.id', 'pu.project_id')
        .where('pu.user_id', userId)
        .where('p.deleted', false)
        .orderBy('pu.order', 'asc')
        .orderBy('p.created_at', 'desc')
        .limit(pageSize)
        .offset(offset),
      db
        .count({ count: '*' })
        .from(`${this.tableName} as p`)
        .join(`${MetaTable.PROJECT_USERS} as pu`, 'p.id', 'pu.project_id')
        .where('pu.user_id', userId)
        .where('p.deleted', false)
        .first(),
    ]);

    return {
      data: results as ProjectWithRole[],
      total: Number(countResult?.count || 0),
      page,
      pageSize,
    };
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  /**
   * Create a new project
   */
  async createProject(input: CreateProjectInput, ownerId: string, options?: ServiceOptions): Promise<Project> {
    const prefix = input.prefix || this.generatePrefix(input.title);

    return this.transaction(async (trx) => {
      const txOptions = { knex: trx, skipCache: options?.skipCache };

      // Create project
      const project = await this.create({
        title: input.title.trim(),
        prefix,
        description: input.description?.trim(),
        org_id: input.org_id,
        is_meta: false,
        deleted: false,
        order: 0,
        meta: input.meta,
      } as Partial<Project>, txOptions);

      // Add owner to project
      await this.addUser(project.id, ownerId, 'owner', txOptions);

      // Invalidate user's project list cache
      const cache = this.getCache();
      await cache.del(`projects:user:${ownerId}`);

      return project;
    });
  }

  /**
   * Update a project
   */
  async updateProject(id: string, input: UpdateProjectInput, options?: ServiceOptions): Promise<Project> {
    const updateData: Partial<Project> = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim();
    if (input.order !== undefined) updateData.order = input.order;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.meta !== undefined) updateData.meta = input.meta;

    return this.update(id, updateData, options);
  }

  /**
   * Soft delete a project
   */
  async deleteProject(id: string, options?: ServiceOptions): Promise<boolean> {
    const project = await this.getById(id, options);
    if (!project) {
      return false;
    }

    await this.update(id, { deleted: true } as Partial<Project>, options);

    // Invalidate caches
    const cache = this.getCache();
    await cache.del(this.getCacheKey(id));
    await this.invalidateListCache();

    return true;
  }

  // ============================================================================
  // Project User Management
  // ============================================================================

  /**
   * Add user to project
   */
  async addUser(
    projectId: string,
    userId: string,
    role: ProjectRole = 'viewer',
    options?: ServiceOptions
  ): Promise<string> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    const data: Partial<ProjectUser> = {
      id,
      project_id: projectId,
      user_id: userId,
      roles: role,
      starred: false,
      hidden: false,
      order: 0,
      created_at: now,
      updated_at: now,
    };

    await db(MetaTable.PROJECT_USERS).insert(data);

    // Invalidate user's project list cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.del(`projects:user:${userId}`);
    }

    return id;
  }

  /**
   * Update user role in project
   */
  async updateUserRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
    options?: ServiceOptions
  ): Promise<void> {
    const db = this.getDb(options);

    await db(MetaTable.PROJECT_USERS)
      .where({ project_id: projectId, user_id: userId })
      .update({ roles: role, updated_at: new Date() });

    // Invalidate user's project list cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.del(`projects:user:${userId}`);
    }
  }

  /**
   * Remove user from project
   */
  async removeUser(projectId: string, userId: string, options?: ServiceOptions): Promise<void> {
    const db = this.getDb(options);

    await db(MetaTable.PROJECT_USERS)
      .where({ project_id: projectId, user_id: userId })
      .delete();

    // Invalidate user's project list cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.del(`projects:user:${userId}`);
    }
  }

  /**
   * Get user's role in project
   */
  async getUserRole(projectId: string, userId: string, options?: ServiceOptions): Promise<ProjectRole | null> {
    const db = this.getDb(options);

    const result = await db(MetaTable.PROJECT_USERS)
      .where({ project_id: projectId, user_id: userId })
      .select('roles')
      .first();

    return (result?.roles as ProjectRole) || null;
  }

  /**
   * List all users in a project
   */
  async listUsers(projectId: string, options?: ServiceOptions): Promise<ProjectUserInfo[]> {
    const db = this.getDb(options);

    return db
      .select('pu.*', 'u.email', 'u.firstname', 'u.lastname')
      .from(`${MetaTable.PROJECT_USERS} as pu`)
      .join(`${MetaTable.USERS} as u`, 'pu.user_id', 'u.id')
      .where('pu.project_id', projectId)
      .orderBy('pu.created_at', 'asc');
  }

  /**
   * Check if user has access to project
   */
  async hasAccess(projectId: string, userId: string, options?: ServiceOptions): Promise<boolean> {
    const role = await this.getUserRole(projectId, userId, options);
    return role !== null;
  }

  /**
   * Check if user has specific permission in project
   */
  async hasPermission(
    projectId: string,
    userId: string,
    permission: string,
    options?: ServiceOptions
  ): Promise<boolean> {
    const role = await this.getUserRole(projectId, userId, options);
    if (!role) return false;

    // Import ACL from types
    const { PROJECT_ACL } = await import('../types/index.js');
    return PROJECT_ACL[role]?.[permission] === true;
  }

  /**
   * Ensure user has permission, throw if not
   */
  async requirePermission(
    projectId: string,
    userId: string,
    permission: string,
    options?: ServiceOptions
  ): Promise<void> {
    const hasPermission = await this.hasPermission(projectId, userId, permission, options);
    if (!hasPermission) {
      throw new AuthorizationError(`You do not have permission to ${permission} in this project`);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a URL-safe prefix from title
   */
  private generatePrefix(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 10);
  }
}

// Export singleton instance
export const ProjectService = new ProjectServiceImpl();

export default ProjectService;
