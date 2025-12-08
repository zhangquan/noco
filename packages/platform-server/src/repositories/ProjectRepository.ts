/**
 * Project Repository
 * Data access layer for project operations
 * @module repositories/ProjectRepository
 */

import { BaseRepository, type RepositoryOptions } from './BaseRepository.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Project, ProjectUser, ProjectRole } from '../types/index.js';
import { generateId } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ProjectRecord extends Project {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectData {
  title: string;
  prefix?: string;
  description?: string;
  org_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  order?: number;
  color?: string;
  meta?: Record<string, unknown>;
  deleted?: boolean;
}

export interface ProjectUserRecord extends ProjectUser {
  email?: string;
  firstname?: string;
  lastname?: string;
}

// ============================================================================
// Project Repository Class
// ============================================================================

class ProjectRepositoryImpl extends BaseRepository<ProjectRecord> {
  protected tableName = MetaTable.PROJECTS;
  protected cacheScope = CacheScope.PROJECT;

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get project by title
   */
  async getByTitle(title: string, options?: RepositoryOptions): Promise<ProjectRecord | null> {
    return this.findOne({ title, deleted: false }, options);
  }

  /**
   * List all non-deleted projects
   */
  async listAll(options?: RepositoryOptions): Promise<ProjectRecord[]> {
    return this.list('all', {
      ...options,
      condition: { deleted: false },
      orderBy: { order: 'asc', created_at: 'desc' },
    });
  }

  /**
   * List projects for a user
   */
  async listForUser(userId: string, options?: RepositoryOptions): Promise<ProjectRecord[]> {
    const cache = this.getCache();
    const cacheKey = `projects:user:${userId}`;

    if (!options?.skipCache) {
      const cached = await cache.get<ProjectRecord[]>(cacheKey);
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

    return results as ProjectRecord[];
  }

  /**
   * List projects for user with pagination
   */
  async listForUserPaginated(
    userId: string,
    page: number = 1,
    pageSize: number = 25,
    options?: RepositoryOptions
  ): Promise<{ data: ProjectRecord[]; total: number }> {
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
      data: results as ProjectRecord[],
      total: Number(countResult?.count || 0),
    };
  }

  // ==========================================================================
  // Create / Update Operations
  // ==========================================================================

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData, options?: RepositoryOptions): Promise<ProjectRecord> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    const prefix = data.prefix || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 10);

    const projectData: Partial<ProjectRecord> = {
      id,
      title: data.title.trim(),
      prefix,
      description: data.description?.trim(),
      org_id: data.org_id,
      is_meta: false,
      deleted: false,
      order: 0,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(this.tableName).insert(projectData);

    const project = await this.getById(id, { ...options, skipCache: true });
    if (!project) throw new Error('Failed to create project');

    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), project);
      await cache.invalidateList(this.cacheScope, 'all');
    }

    return project;
  }

  /**
   * Update a project
   */
  async updateProject(id: string, data: UpdateProjectData, options?: RepositoryOptions): Promise<void> {
    const updateData: Partial<ProjectRecord> = { ...data };
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim();

    await this.update(id, updateData, options);

    if (!options?.skipCache) {
      await this.invalidateListCache('all');
    }
  }

  /**
   * Soft delete a project
   */
  async softDelete(id: string, options?: RepositoryOptions): Promise<void> {
    await this.updateProject(id, { deleted: true }, options);

    if (!options?.skipCache) {
      await this.invalidateCache(id);
      await this.invalidateListCache('all');
    }
  }

  // ==========================================================================
  // Project User Management
  // ==========================================================================

  /**
   * Add user to project
   */
  async addUser(
    projectId: string,
    userId: string,
    roles: ProjectRole = 'viewer',
    options?: RepositoryOptions
  ): Promise<string> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    const data: Partial<ProjectUser> = {
      id,
      project_id: projectId,
      user_id: userId,
      roles,
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
    roles: ProjectRole,
    options?: RepositoryOptions
  ): Promise<void> {
    const db = this.getDb(options);

    await db(MetaTable.PROJECT_USERS)
      .where({ project_id: projectId, user_id: userId })
      .update({ roles, updated_at: new Date() });

    // Invalidate user's project list cache
    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.del(`projects:user:${userId}`);
    }
  }

  /**
   * Remove user from project
   */
  async removeUser(projectId: string, userId: string, options?: RepositoryOptions): Promise<void> {
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
  async getUserRole(projectId: string, userId: string, options?: RepositoryOptions): Promise<ProjectRole | null> {
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
  async listUsers(projectId: string, options?: RepositoryOptions): Promise<ProjectUserRecord[]> {
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
  async hasAccess(projectId: string, userId: string, options?: RepositoryOptions): Promise<boolean> {
    const role = await this.getUserRole(projectId, userId, options);
    return role !== null;
  }

  /**
   * Invalidate user project cache
   */
  async invalidateUserProjectCache(userId: string): Promise<void> {
    const cache = this.getCache();
    await cache.del(`projects:user:${userId}`);
  }
}

// Export singleton instance
export const ProjectRepository = new ProjectRepositoryImpl();

export default ProjectRepository;
