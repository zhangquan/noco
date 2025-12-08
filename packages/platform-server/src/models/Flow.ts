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

  async publish(): Promise<void> {
    await Flow.publish(this.id);
    const updated = await Flow.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
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

  static async publish(id: string, options?: TableOptions): Promise<void> {
    const flow = await this.get(id, options);
    if (!flow) throw new Error('Flow not found');
    if (!flow.schemaId) throw new Error('Flow has no schema to publish');

    await this.update(id, { fk_publish_schema_id: flow.schemaId }, options);
  }

  static async moveToGroup(id: string, groupId: string | null, options?: TableOptions): Promise<void> {
    await this.update(id, { group_id: groupId || undefined }, options);
  }
}

export default Flow;
