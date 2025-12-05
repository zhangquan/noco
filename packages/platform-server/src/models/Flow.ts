/**
 * FlowApp and Flow Models
 * @module models/Flow
 */

import { CacheScope, MetaTable } from '../types/index.js';
import type { FlowApp as FlowAppType, Flow as FlowType, FlowTriggerType } from '../types/index.js';
import { getNcMeta } from '../lib/NcMetaIO.js';
import { NocoCache } from '../cache/index.js';
import {
  getById,
  listRecords,
  updateRecord,
  deleteRecord,
  invalidateListCache,
  type BaseModelOptions,
} from './BaseModel.js';

const FLOW_CACHE_SCOPE = CacheScope.FLOW;
const FLOW_APP_TABLE = MetaTable.FLOW_APPS;
const FLOWS_TABLE = MetaTable.FLOWS;

// ============================================================================
// FlowApp Model
// ============================================================================

export class FlowApp {
  private data: FlowAppType;

  constructor(data: FlowAppType) {
    this.data = data;
  }

  get id(): string { return this.data.id; }
  get projectId(): string { return this.data.project_id; }
  get title(): string { return this.data.title; }
  get schemaId(): string | undefined { return this.data.fk_schema_id; }
  get publishSchemaId(): string | undefined { return this.data.fk_publish_schema_id; }
  get triggerType(): FlowTriggerType | undefined { return this.data.trigger_type; }
  get enabled(): boolean { return this.data.enabled ?? true; }
  get meta(): Record<string, unknown> | undefined { return this.data.meta; }

  getData(): FlowAppType { return this.data; }
  toJSON(): FlowAppType { return { ...this.data }; }

  async update(data: Partial<Pick<FlowAppType, 'title' | 'trigger_type' | 'enabled' | 'meta' | 'fk_schema_id' | 'fk_publish_schema_id'>>): Promise<void> {
    await FlowApp.update(this.id, data);
    const updated = await FlowApp.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  async getFlows(options?: BaseModelOptions): Promise<Flow[]> {
    return Flow.listForFlowApp(this.id, options);
  }

  static async get(id: string, options?: BaseModelOptions): Promise<FlowApp | null> {
    const data = await getById<FlowAppType>(FLOW_CACHE_SCOPE, FLOW_APP_TABLE, id, options);
    return data ? new FlowApp(data) : null;
  }

  static async insert(data: {
    project_id: string;
    title: string;
    trigger_type?: FlowTriggerType;
    fk_schema_id?: string;
    meta?: Record<string, unknown>;
  }, options?: BaseModelOptions): Promise<FlowApp> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    const flowAppData: Partial<FlowAppType> = {
      project_id: data.project_id,
      title: data.title,
      trigger_type: data.trigger_type || 'manual',
      fk_schema_id: data.fk_schema_id,
      enabled: true,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, FLOW_APP_TABLE, flowAppData as Record<string, unknown>);
    const flowApp = await this.get(id, { ...options, skipCache: true });
    if (!flowApp) throw new Error('Failed to create flow app');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${FLOW_CACHE_SCOPE}:${id}`, flowApp.getData());
      await cache.invalidateList(FLOW_CACHE_SCOPE, data.project_id);
    }

    return flowApp;
  }

  static async update(id: string, data: Partial<Pick<FlowAppType, 'title' | 'trigger_type' | 'fk_schema_id' | 'fk_publish_schema_id' | 'enabled' | 'meta'>>, options?: BaseModelOptions): Promise<void> {
    const flowApp = await this.get(id, options);
    await updateRecord<FlowAppType>(FLOW_CACHE_SCOPE, FLOW_APP_TABLE, id, data, options);
    if (flowApp && !options?.skipCache) {
      await invalidateListCache(FLOW_CACHE_SCOPE, flowApp.projectId);
    }
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const flowApp = await this.get(id, options);
    if (flowApp) {
      const ncMeta = options?.ncMeta || getNcMeta();
      await ncMeta.metaDeleteAll(null, null, FLOWS_TABLE, { flow_app_id: id });
    }
    const result = await deleteRecord(FLOW_CACHE_SCOPE, FLOW_APP_TABLE, id, options);
    if (flowApp && !options?.skipCache) {
      await invalidateListCache(FLOW_CACHE_SCOPE, flowApp.projectId);
    }
    return result;
  }

  static async listForProject(projectId: string, options?: BaseModelOptions): Promise<FlowApp[]> {
    const data = await listRecords<FlowAppType>(
      FLOW_CACHE_SCOPE,
      FLOW_APP_TABLE,
      projectId,
      { condition: { project_id: projectId }, orderBy: { created_at: 'desc' } },
      options
    );
    return data.map(d => new FlowApp(d));
  }

  static async publish(id: string, options?: BaseModelOptions): Promise<void> {
    const flowApp = await this.get(id, options);
    if (!flowApp) throw new Error('Flow app not found');
    if (!flowApp.schemaId) throw new Error('Flow app has no schema to publish');
    await this.update(id, { fk_publish_schema_id: flowApp.schemaId }, options);
  }
}

// ============================================================================
// Flow Model (Version)
// ============================================================================

export class Flow {
  private data: FlowType;

  constructor(data: FlowType) {
    this.data = data;
  }

  get id(): string { return this.data.id; }
  get flowAppId(): string { return this.data.flow_app_id; }
  get title(): string { return this.data.title; }
  get version(): number { return this.data.version ?? 1; }
  get definition(): Record<string, unknown> | undefined { return this.data.definition; }
  get status(): 'draft' | 'published' | 'archived' { return this.data.status ?? 'draft'; }

  getData(): FlowType { return this.data; }
  toJSON(): FlowType { return { ...this.data }; }

  async update(data: Partial<Pick<FlowType, 'title' | 'definition' | 'status'>>): Promise<void> {
    await Flow.update(this.id, data);
    const updated = await Flow.get(this.id, { skipCache: true });
    if (updated) this.data = updated.getData();
  }

  async publish(): Promise<void> {
    await this.update({ status: 'published' });
  }

  static async get(id: string, options?: BaseModelOptions): Promise<Flow | null> {
    const data = await getById<FlowType>(FLOW_CACHE_SCOPE, FLOWS_TABLE, id, options);
    return data ? new Flow(data) : null;
  }

  static async insert(data: {
    flow_app_id: string;
    title: string;
    definition?: Record<string, unknown>;
  }, options?: BaseModelOptions): Promise<Flow> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const now = new Date();

    const maxVersion = await ncMeta.getKnex()
      .from(FLOWS_TABLE)
      .where('flow_app_id', data.flow_app_id)
      .max('version as max')
      .first();

    const flowData: Partial<FlowType> = {
      flow_app_id: data.flow_app_id,
      title: data.title,
      version: ((maxVersion as any)?.max || 0) + 1,
      definition: data.definition,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    const id = await ncMeta.metaInsert(null, null, FLOWS_TABLE, flowData as Record<string, unknown>);
    const flow = await this.get(id, { ...options, skipCache: true });
    if (!flow) throw new Error('Failed to create flow');

    if (!options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.set(`${FLOW_CACHE_SCOPE}:flow:${id}`, flow.getData());
      await cache.invalidateList(FLOW_CACHE_SCOPE, `flows:${data.flow_app_id}`);
    }

    return flow;
  }

  static async update(id: string, data: Partial<Pick<FlowType, 'title' | 'definition' | 'status'>>, options?: BaseModelOptions): Promise<void> {
    const flow = await this.get(id, options);
    await updateRecord<FlowType>(FLOW_CACHE_SCOPE, FLOWS_TABLE, id, data, options);
    if (flow && !options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`${FLOW_CACHE_SCOPE}:flow:${id}`);
      await cache.invalidateList(FLOW_CACHE_SCOPE, `flows:${flow.flowAppId}`);
    }
  }

  static async delete(id: string, options?: BaseModelOptions): Promise<number> {
    const flow = await this.get(id, options);
    const result = await deleteRecord(FLOW_CACHE_SCOPE, FLOWS_TABLE, id, options);
    if (flow && !options?.skipCache) {
      const cache = NocoCache.getInstance();
      await cache.del(`${FLOW_CACHE_SCOPE}:flow:${id}`);
      await cache.invalidateList(FLOW_CACHE_SCOPE, `flows:${flow.flowAppId}`);
    }
    return result;
  }

  static async listForFlowApp(flowAppId: string, options?: BaseModelOptions): Promise<Flow[]> {
    const cache = NocoCache.getInstance();
    const ncMeta = options?.ncMeta || getNcMeta();
    const cacheKey = `${FLOW_CACHE_SCOPE}:list:flows:${flowAppId}`;

    if (!options?.skipCache) {
      const cached = await cache.get<FlowType[]>(cacheKey);
      if (cached) return cached.map(d => new Flow(d));
    }

    const dataList = await ncMeta.metaList(null, null, FLOWS_TABLE, {
      condition: { flow_app_id: flowAppId },
      orderBy: { version: 'desc' },
    });

    if (!options?.skipCache) {
      await cache.set(cacheKey, dataList);
    }

    return dataList.map(d => new Flow(d as unknown as FlowType));
  }

  static async getLatest(flowAppId: string, options?: BaseModelOptions): Promise<Flow | null> {
    const ncMeta = options?.ncMeta || getNcMeta();
    const data = await ncMeta.getKnex()
      .from(FLOWS_TABLE)
      .where('flow_app_id', flowAppId)
      .orderBy('version', 'desc')
      .first();
    if (!data) return null;
    return new Flow(data as unknown as FlowType);
  }
}
