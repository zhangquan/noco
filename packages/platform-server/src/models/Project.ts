/**
 * Project Model
 * @module models/Project
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { Project as ProjectType, ProjectUser, ProjectRole } from '../types/index.js';
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

const CACHE_SCOPE = CacheScope.PROJECT;
const META_TABLE = MetaTable.PROJECTS;

export class Project {
  private data: ProjectType;

  constructor(data: ProjectType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get title(): string { return this.data.title; }
  get prefix(): string { return this.data.prefix; }
  get description(): string | undefined { return this.data.description; }
  get orgId(): string | undefined { return this.data.org_id; }
  get isMeta(): boolean { return this.data.is_meta ?? false; }
  get deleted(): boolean { return this.data.deleted ?? false; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): ProjectType { return this.data; }
  toJSON(): ProjectType { return { ...this.data }; }

  async update(data: Partial<Pick<ProjectType, 'title' | 'description' | 'order' | 'color' | 'meta'>>): Promise<void> {
    await Project.update(this.id, data);
    const updated = await Project.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  async addUser(userId: string, roles?: ProjectRole): Promise<string> {
    return Project.addUser(this.id, userId, roles);
  }

  async getUsers(): Promise<Array<ProjectUser & { email: string }>> {
    return Project.listUsers(this.id);
  }

  // Static methods
  static async get(id: string, options?: BaseModelOptions): Promise<Project | null> {
    const data = await getById<ProjectType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Project(data) : null;
  }

  static async getByTitle(title: string, options?: BaseModelOptions): Promise<Project | null> {
    const data = await getByCondition<ProjectType>(META_TABLE, { title, deleted: false }, options);
    return data ? new Project(data) : null;
  }

  static async createProject(data: {
    title: string;
    prefix?: string;
    description?: string;
    org_id?: string;
    meta?: Record<string, unknown>;
  }, options?: BaseModelOptions): Promise<Project> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    const prefix = data.prefix || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 10);

    const projectData: Partial<ProjectType> = {
      title: data.title,
      prefix,
      description: data.description,
      org_id: data.org_id,
      is_meta: false,
      deleted: false,
      order: 0,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, META_TABLE, projectData as Record<string, unknown>);
    const project = await this.get(id, { ...options, skipCache: true });
    if (!project) throw new Error('Failed to create project');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, project.getData());
      await cache.invalidateList(CACHE_SCOPE, 'all');
    }

    return project;
  }

  static async update(id: string, data: Partial<Pick<ProjectType, 'title' | 'description' | 'order' | 'color' | 'meta'>>, options?: BaseModelOptions): Promise<void> {
    await updateRecord<ProjectType>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (!options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, 'all');
    }
  }

  static async softDelete(id: string, options?: BaseModelOptions): Promise<void> {
    await updateRecord<ProjectType>(CACHE_SCOPE, META_TABLE, id, { deleted: true }, options);
    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`${CACHE_SCOPE}:${id}`);
      await cache.invalidateList(CACHE_SCOPE, 'all');
    }
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (!options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, 'all');
    }
    return result;
  }

  static async list(options?: BaseModelOptions): Promise<Project[]> {
    const data = await listRecords<ProjectType>(
      CACHE_SCOPE,
      META_TABLE,
      'all',
      { condition: { deleted: false }, orderBy: { order: 'asc', created_at: 'desc' } },
      options
    );
    return data.map(d => new Project(d));
  }

  static async listForUser(userId: string, options?: BaseModelOptions): Promise<Project[]> {
    const cache = NocoCache.getInstance();
    const cacheKey = `projects:user:${userId}`;

    if (!options?.skipCache) {
      const cached = await cache.get<ProjectType[]>(cacheKey);
      if (cached) return cached.map(d => new Project(d));
    }

    const ncMeta = options?.ncMeta || getNcMeta();
    const results = await ncMeta.getKnex()
      .select('p.*')
      .from(`${META_TABLE} as p`)
      .join(`${MetaTable.PROJECT_USERS} as pu`, 'p.id', 'pu.project_id')
      .where('pu.user_id', userId)
      .where('p.deleted', false)
      .orderBy('pu.order', 'asc')
      .orderBy('p.created_at', 'desc');

    if (!options?.skipCache) {
      await cache.set(cacheKey, results, 300);
    }

    return results.map((d: ProjectType) => new Project(d));
  }

  static async count(condition?: Record<string, unknown>): Promise<number> {
    const ncMeta = getNcMeta();
    return ncMeta.metaCount(null, null, META_TABLE, { deleted: false, ...condition });
  }

  // Project User Management
  static async addUser(projectId: string, userId: string, roles: ProjectRole = 'viewer', options?: BaseModelOptions): Promise<string> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    const data: Partial<ProjectUser> = {
      project_id: projectId,
      user_id: userId,
      roles,
      starred: false,
      hidden: false,
      order: 0,
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, MetaTable.PROJECT_USERS, data as Record<string, unknown>);

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`projects:user:${userId}`);
    }

    return id;
  }

  static async updateUserRole(projectId: string, userId: string, roles: ProjectRole, options?: BaseModelOptions): Promise<void> {
    const ncMeta = options?.ncMeta || getNcMeta();
    await ncMeta.metaUpdate(null, null, MetaTable.PROJECT_USERS, { roles, updated_at: new Date() }, { project_id: projectId, user_id: userId });
    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`projects:user:${userId}`);
    }
  }

  static async removeUser(projectId: string, userId: string, options?: BaseModelOptions): Promise<void> {
    const ncMeta = options?.ncMeta || getNcMeta();
    await ncMeta.metaDelete(null, null, MetaTable.PROJECT_USERS, { project_id: projectId, user_id: userId });
    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`projects:user:${userId}`);
    }
  }

  static async getUserRole(projectId: string, userId: string, options?: BaseModelOptions): Promise<ProjectRole | null> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const result = await ncMeta.metaGet2(null, null, MetaTable.PROJECT_USERS, { project_id: projectId, user_id: userId }, ['roles']);
    return result?.roles as ProjectRole | null;
  }

  static async listUsers(projectId: string, options?: BaseModelOptions): Promise<Array<ProjectUser & { email: string; firstname?: string; lastname?: string }>> {
    const ncMeta = options?.ncMeta || getNcMeta();
    return ncMeta.getKnex()
      .select('pu.*', 'u.email', 'u.firstname', 'u.lastname')
      .from(`${MetaTable.PROJECT_USERS} as pu`)
      .join(`${MetaTable.USERS} as u`, 'pu.user_id', 'u.id')
      .where('pu.project_id', projectId)
      .orderBy('pu.created_at', 'asc');
  }
}

export default Project;
