/**
 * Flow Model
 * @module models/Flow
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { Flow as FlowType, FlowTriggerType } from '../types/index.js';
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

const CACHE_SCOPE = CacheScope.FLOW;
const META_TABLE = MetaTable.FLOWS;

export class Flow {
  private data: FlowType;

  constructor(data: FlowType) {
    this.data = data;
  }

  // Getters
  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get groupId(): string | undefined { return this.data.group_id; }
  get title(): string { return this.data.title; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get triggerType(): FlowTriggerType { return this.data.trigger_type ?? 'manual'; }
  get enabled(): boolean { return this.data.enabled ?? true; }
  get order(): number { return this.data.order ?? 0; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): FlowType { return this.data; }
  toJSON(): FlowType { return { ...this.data }; }

  async update(data: Partial<Pick<FlowType, 'title' | 'trigger_type' | 'enabled' | 'order' | 'group_id' | 'fk_schema_id' | 'meta'>>): Promise<void> {
    await Flow.update(this.id, data);
    const updated = await Flow.get(this.id, { skipCache: true });
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
      domain: 'flow',
      fk_domain_id: this.id,
      fk_project_id: this.projectId,
      env: 'DEV',
    }, options);
  }

  /**
   * Get published Schema model instance (PRO environment)
   */
  async getPublicSchemaModel(options?: TableOptions): Promise<Schema | null> {
    return Schema.getByDomainAndEnv('flow', this.id, 'PRO', options);
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
      throw new Error('Schema not found for flow');
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
        domain: 'flow',
        fk_domain_id: this.id,
        fk_project_id: this.projectId,
        data,
        env: 'DEV',
      }, options);

      // Update flow with schema reference
      await Flow.update(this.id, { fk_schema_id: newSchema.id }, options);
      this.data.fk_schema_id = newSchema.id;
      return newSchema;
    }

    await schemaModel.updateData(data, options);
    return schemaModel;
  }

  /**
   * Publish schema (copy DEV to PRO) - instance method
   */
  async publishSchema(options?: TableOptions): Promise<Schema> {
    const schemaModel = await this.getSchemaModel(options);
    if (!schemaModel) {
      throw new Error('No schema to publish');
    }

    const publishedSchema = await schemaModel.publish(options);

    // Update flow with published schema reference
    await Flow.update(this.id, { fk_publish_schema_id: publishedSchema.id }, options);
    this.data.fk_publish_schema_id = publishedSchema.id;

    return publishedSchema;
  }

  /**
   * Add a node to flow schema
   */
  async addNode(node: Record<string, unknown>, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'add', path: '/nodes/-', value: node }
    ], options);
  }

  /**
   * Update a node in flow schema
   */
  async updateNode(
    nodeIndex: number,
    updates: Record<string, unknown>,
    options?: TableOptions
  ): Promise<SchemaPatchResult> {
    const patches: JsonPatchOperation[] = Object.entries(updates).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/nodes/${nodeIndex}/${key}`,
      value,
    }));
    return this.patchSchema(patches, options);
  }

  /**
   * Remove a node from flow schema
   */
  async removeNode(nodeIndex: number, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'remove', path: `/nodes/${nodeIndex}` }
    ], options);
  }

  /**
   * Add an edge to flow schema
   */
  async addEdge(edge: Record<string, unknown>, options?: TableOptions): Promise<SchemaPatchResult> {
    return this.patchSchema([
      { op: 'add', path: '/edges/-', value: edge }
    ], options);
  }

  // Static methods
  static async get(id: string, options?: TableOptions): Promise<Flow | null> {
    const data = await getById<FlowType>(CACHE_SCOPE, META_TABLE, id, options);
    return data ? new Flow(data) : null;
  }

  static async getByTitle(projectId: string, title: string, options?: TableOptions): Promise<Flow | null> {
    const data = await getByCondition<FlowType>(META_TABLE, { project_id: projectId, title }, options);
    return data ? new Flow(data) : null;
  }

  static async insert(data: {
    project_id: string;
    title: string;
    trigger_type?: FlowTriggerType;
    group_id?: string;
    fk_schema_id?: string;
    meta?: Record<string, unknown>;
  }, options?: TableOptions): Promise<Flow> {
    const db = options?.knex || getDb();
    const now = new Date();
    const id = generateId();

    const maxOrder = await db
      .from(META_TABLE)
      .where('project_id', data.project_id)
      .max('order as max')
      .first();

    const flowData: Partial<FlowType> = {
      id,
      project_id: data.project_id,
      group_id: data.group_id,
      title: data.title,
      trigger_type: data.trigger_type || 'manual',
      fk_schema_id: data.fk_schema_id,
      enabled: true,
      order: ((maxOrder as any)?.max || 0) + 1,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(META_TABLE).insert(flowData);
    
    const flow = await this.get(id, { ...options, skipCache: true });
    if (!flow) throw new Error('Failed to create flow');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${CACHE_SCOPE}:${id}`, flow.getData());
      await cache.invalidateList(CACHE_SCOPE, data.project_id);
    }

    return flow;
  }

  static async update(id: string, data: Partial<Pick<FlowType, 'title' | 'trigger_type' | 'fk_schema_id' | 'fk_publish_schema_id' | 'enabled' | 'order' | 'group_id' | 'meta'>>, options?: TableOptions): Promise<void> {
    const flow = await this.get(id, options);
    await updateRecord<FlowType>(CACHE_SCOPE, META_TABLE, id, data, options);
    if (flow && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, flow.projectId);
    }
  }

  static async delete(id: string, options?: TableOptions): Promise<number> {
    const flow = await this.get(id, options);
    const result = await deleteRecord(CACHE_SCOPE, META_TABLE, id, options);
    if (flow && !options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, flow.projectId);
    }
    return result;
  }

  static async listForProject(projectId: string, groupId?: string, options?: TableOptions): Promise<Flow[]> {
    const condition: Record<string, unknown> = { project_id: projectId };
    if (groupId !== undefined) {
      condition.group_id = groupId;
    }

    const data = await listRecords<FlowType>(
      CACHE_SCOPE,
      META_TABLE,
      groupId ? `${projectId}:${groupId}` : projectId,
      { condition, orderBy: { order: 'asc', created_at: 'desc' } },
      options
    );
    return data.map(d => new Flow(d));
  }

  static async reorder(projectId: string, flowOrders: Array<{ id: string; order: number }>, options?: TableOptions): Promise<void> {
    const db = options?.knex || getDb();

    await db.transaction(async (trx) => {
      for (const { id, order } of flowOrders) {
        await trx(META_TABLE).where('id', id).update({ order, updated_at: new Date() });
      }
    });

    if (!options?.skipCache) {
      await invalidateListCache(CACHE_SCOPE, projectId);
      const cache = NocoCache.getInstance();
      for (const { id } of flowOrders) {
        await cache.del(`${CACHE_SCOPE}:${id}`);
      }
    }
  }

  static async publish(id: string, options?: TableOptions): Promise<Schema> {
    const flow = await this.get(id, options);
    if (!flow) throw new Error('Flow not found');

    return flow.publishSchema(options);
  }

  static async moveToGroup(id: string, groupId: string | null, options?: TableOptions): Promise<void> {
    await this.update(id, { group_id: groupId || undefined }, options);
  }
}

export default Flow;
