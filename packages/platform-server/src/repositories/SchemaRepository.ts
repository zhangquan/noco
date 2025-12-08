/**
 * Schema Repository
 * Data access layer for schema operations
 * @module repositories/SchemaRepository
 */

import { BaseRepository, type RepositoryOptions } from './BaseRepository.js';
import { CacheScope, MetaTable, type SchemaDomain, type SchemaEnv } from '../types/index.js';
import { generateId } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface SchemaRecord {
  id: string;
  /** Domain: 'model' | 'page' | 'flow' | 'app' */
  domain: SchemaDomain;
  /** Foreign key to domain entity (model_id, page_id, flow_id) */
  fk_domain_id: string;
  /** Project ID */
  fk_project_id: string;
  /** Schema JSON data */
  data: Record<string, unknown>;
  /** Environment: 'DEV' | 'PRO' */
  env: SchemaEnv;
  /** Schema version (auto-incremented) */
  version: number;
  /** Created timestamp */
  created_at: Date;
  /** Updated timestamp */
  updated_at: Date;
}

export interface CreateSchemaData {
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data?: Record<string, unknown>;
  env?: SchemaEnv;
}

export interface UpdateSchemaData {
  data?: Record<string, unknown>;
  version?: number;
  env?: SchemaEnv;
}

// ============================================================================
// Schema Repository Class
// ============================================================================

class SchemaRepositoryImpl extends BaseRepository<SchemaRecord> {
  protected tableName = MetaTable.SCHEMAS;
  protected cacheScope = CacheScope.SCHEMA;

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get schema by domain entity and environment
   */
  async getByDomainAndEnv(
    domain: SchemaDomain,
    domainId: string,
    env: SchemaEnv = 'DEV',
    options?: RepositoryOptions
  ): Promise<SchemaRecord | null> {
    const db = this.getDb(options);
    const data = await db(this.tableName)
      .where({
        domain,
        fk_domain_id: domainId,
        env,
      })
      .orderBy('version', 'desc')
      .first();

    return data || null;
  }

  /**
   * Get or create schema for domain entity
   */
  async getOrCreate(
    createData: CreateSchemaData,
    options?: RepositoryOptions
  ): Promise<SchemaRecord> {
    const existing = await this.getByDomainAndEnv(
      createData.domain,
      createData.fk_domain_id,
      createData.env || 'DEV',
      options
    );

    if (existing) {
      return existing;
    }

    return this.createSchema(createData, options);
  }

  /**
   * List schemas for a project
   */
  async listForProject(
    projectId: string,
    domain?: SchemaDomain,
    options?: RepositoryOptions
  ): Promise<SchemaRecord[]> {
    const condition: Record<string, unknown> = { fk_project_id: projectId };
    if (domain) {
      condition.domain = domain;
    }

    return this.list(domain ? `${projectId}:${domain}` : projectId, {
      ...options,
      condition,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * List schema versions for a domain entity
   */
  async listVersions(
    domain: SchemaDomain,
    domainId: string,
    env: SchemaEnv = 'DEV',
    options?: RepositoryOptions
  ): Promise<SchemaRecord[]> {
    const db = this.getDb(options);
    return db(this.tableName)
      .where({ domain, fk_domain_id: domainId, env })
      .orderBy('version', 'desc');
  }

  /**
   * Get specific version of schema
   */
  async getVersion(
    domain: SchemaDomain,
    domainId: string,
    version: number,
    env: SchemaEnv = 'DEV',
    options?: RepositoryOptions
  ): Promise<SchemaRecord | null> {
    const db = this.getDb(options);
    return db(this.tableName)
      .where({ domain, fk_domain_id: domainId, env, version })
      .first();
  }

  // ==========================================================================
  // Create / Update Operations
  // ==========================================================================

  /**
   * Create a new schema
   */
  async createSchema(data: CreateSchemaData, options?: RepositoryOptions): Promise<SchemaRecord> {
    const db = this.getDb(options);
    const cache = this.getCache();
    const now = new Date();
    const id = generateId();

    const schemaData: Partial<SchemaRecord> = {
      id,
      domain: data.domain,
      fk_domain_id: data.fk_domain_id,
      fk_project_id: data.fk_project_id,
      data: data.data || {},
      env: data.env || 'DEV',
      version: 1,
      created_at: now,
      updated_at: now,
    };

    await db(this.tableName).insert(schemaData);

    const schema = await this.getById(id, { ...options, skipCache: true });
    if (!schema) throw new Error('Failed to create schema');

    if (!options?.skipCache) {
      await cache.set(this.getCacheKey(id), schema);
      await cache.invalidateList(this.cacheScope, data.fk_project_id);
    }

    return schema;
  }

  /**
   * Update schema record
   */
  async updateSchema(id: string, data: UpdateSchemaData, options?: RepositoryOptions): Promise<void> {
    const schema = await this.getById(id, options);
    await this.update(id, data, options);

    if (schema && !options?.skipCache) {
      await this.invalidateListCache(schema.fk_project_id);
    }
  }

  /**
   * Update schema data with version increment
   */
  async updateData(
    id: string,
    data: Record<string, unknown>,
    options?: RepositoryOptions
  ): Promise<void> {
    const schema = await this.getById(id, options);
    if (!schema) throw new Error('Schema not found');

    const newVersion = schema.version + 1;
    await this.updateSchema(id, { data, version: newVersion }, options);
  }

  /**
   * Delete schema
   */
  async deleteSchema(id: string, options?: RepositoryOptions): Promise<number> {
    const schema = await this.getById(id, options);
    const result = await this.delete(id, options);

    if (schema && !options?.skipCache) {
      await this.invalidateListCache(schema.fk_project_id);
    }

    return result;
  }

  /**
   * Delete all schemas for a domain entity
   */
  async deleteByDomain(
    domain: SchemaDomain,
    domainId: string,
    options?: RepositoryOptions
  ): Promise<number> {
    const db = this.getDb(options);
    const result = await db(this.tableName)
      .where({ domain, fk_domain_id: domainId })
      .delete();

    if (!options?.skipCache) {
      await this.invalidateListCache(domainId);
    }

    return result;
  }

  /**
   * Clone schema to another domain entity
   */
  async clone(
    sourceId: string,
    targetDomainId: string,
    options?: RepositoryOptions
  ): Promise<SchemaRecord> {
    const source = await this.getById(sourceId, options);
    if (!source) {
      throw new Error(`Source schema not found: ${sourceId}`);
    }

    return this.createSchema({
      domain: source.domain,
      fk_domain_id: targetDomainId,
      fk_project_id: source.fk_project_id,
      data: JSON.parse(JSON.stringify(source.data)),
      env: 'DEV',
    }, options);
  }

  /**
   * Publish schema (copy DEV to PRO)
   */
  async publish(
    domain: SchemaDomain,
    domainId: string,
    options?: RepositoryOptions
  ): Promise<SchemaRecord> {
    const devSchema = await this.getByDomainAndEnv(domain, domainId, 'DEV', options);
    if (!devSchema) {
      throw new Error('No DEV schema to publish');
    }

    // Check for existing PRO schema
    const existingPro = await this.getByDomainAndEnv(domain, domainId, 'PRO', options);
    if (existingPro) {
      // Update existing PRO schema
      await this.updateData(existingPro.id, devSchema.data, options);
      return (await this.getById(existingPro.id, options))!;
    }

    // Create new PRO schema
    return this.createSchema({
      domain,
      fk_domain_id: domainId,
      fk_project_id: devSchema.fk_project_id,
      data: devSchema.data,
      env: 'PRO',
    }, options);
  }
}

// Export singleton instance
export const SchemaRepository = new SchemaRepositoryImpl();

export default SchemaRepository;
