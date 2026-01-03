/**
 * Flow Repository
 * Data access layer for flow/workflow operations
 * @module repositories/FlowRepository
 */

import { BaseRepository, type RepositoryOptions } from './BaseRepository.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Flow, FlowTriggerType, AnalysisType } from '../types/index.js';
import { generateId } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface FlowRecord extends Flow {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFlowData {
  project_id: string;
  title: string;
  trigger_type?: FlowTriggerType;
  /** Analysis type - for automatic team grouping */
  analysis_type?: AnalysisType;
  group_id?: string;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateFlowData {
  title?: string;
  trigger_type?: FlowTriggerType;
  /** Analysis type - for automatic team grouping */
  analysis_type?: AnalysisType | null;
  enabled?: boolean;
  order?: number;
  group_id?: string | null;
  fk_schema_id?: string;
  fk_publish_schema_id?: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Flow Repository Class
// ============================================================================

class FlowRepositoryImpl extends BaseRepository<FlowRecord> {
  protected tableName = MetaTable.FLOWS;
  protected cacheScope = CacheScope.FLOW;

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get flow by title within a project
   */
  async getByTitle(projectId: string, title: string, options?: RepositoryOptions): Promise<FlowRecord | null> {
    return this.findOne({ project_id: projectId, title }, options);
  }

  /**
   * List flows for a project
   */
  async listForProject(projectId: string, groupId?: string, options?: RepositoryOptions): Promise<FlowRecord[]> {
    const condition: Record<string, unknown> = { project_id: projectId };

    if (groupId !== undefined) {
      condition.group_id = groupId || null;
    }

    return this.list(groupId ? `${projectId}:${groupId}` : projectId, {
      ...options,
      condition,
      orderBy: { order: 'asc', created_at: 'desc' },
    });
  }

  /**
   * List enabled flows for a project
   */
  async listEnabled(projectId: string, options?: RepositoryOptions): Promise<FlowRecord[]> {
    return this.findMany({
      ...options,
      condition: { project_id: projectId, enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * List flows by trigger type
   */
  async listByTrigger(
    projectId: string,
    triggerType: FlowTriggerType,
    options?: RepositoryOptions
  ): Promise<FlowRecord[]> {
    return this.findMany({
      ...options,
      condition: { project_id: projectId, trigger_type: triggerType, enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  // ==========================================================================
  // Create / Update Operations
  // ==========================================================================

  /**
   * Create a new flow
   */
  async createFlow(data: CreateFlowData, options?: RepositoryOptions): Promise<FlowRecord> {
    const db = this.getDb(options);
    const now = new Date();
    const id = generateId();

    // Get max order
    const maxOrder = await db
      .from(this.tableName)
      .where('project_id', data.project_id)
      .max('order as max')
      .first();

    const flowData: Partial<FlowRecord> = {
      id,
      project_id: data.project_id,
      group_id: data.group_id,
      title: data.title.trim(),
      trigger_type: data.trigger_type || 'manual',
      analysis_type: data.analysis_type,
      fk_schema_id: data.fk_schema_id,
      enabled: true,
      order: ((maxOrder as any)?.max || 0) + 1,
      meta: data.meta,
      created_at: now,
      updated_at: now,
    };

    await db(this.tableName).insert(flowData);

    const flow = await this.getById(id, { ...options, skipCache: true });
    if (!flow) throw new Error('Failed to create flow');

    if (!options?.skipCache) {
      const cache = this.getCache();
      await cache.set(this.getCacheKey(id), flow);
      await cache.invalidateList(this.cacheScope, data.project_id);
    }

    return flow;
  }

  /**
   * Update a flow
   */
  async updateFlow(id: string, data: UpdateFlowData, options?: RepositoryOptions): Promise<void> {
    const flow = await this.getById(id, options);
    const updateData: Partial<FlowRecord> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
    if (data.analysis_type !== undefined) updateData.analysis_type = data.analysis_type === null ? undefined : data.analysis_type;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.group_id !== undefined) updateData.group_id = data.group_id === null ? undefined : data.group_id;
    if (data.fk_schema_id !== undefined) updateData.fk_schema_id = data.fk_schema_id;
    if (data.fk_publish_schema_id !== undefined) updateData.fk_publish_schema_id = data.fk_publish_schema_id;
    if (data.meta !== undefined) updateData.meta = data.meta;

    await this.update(id, updateData, options);

    if (flow && !options?.skipCache) {
      await this.invalidateListCache(flow.project_id);
    }
  }

  /**
   * Delete a flow
   */
  async deleteFlow(id: string, options?: RepositoryOptions): Promise<number> {
    const flow = await this.getById(id, options);
    const result = await this.delete(id, options);

    if (flow && !options?.skipCache) {
      await this.invalidateListCache(flow.project_id);
    }

    return result;
  }

  /**
   * Reorder flows
   */
  async reorder(
    projectId: string,
    flowOrders: Array<{ id: string; order: number }>,
    options?: RepositoryOptions
  ): Promise<void> {
    const db = this.getDb(options);

    await db.transaction(async (trx) => {
      for (const { id, order } of flowOrders) {
        await trx(this.tableName).where('id', id).update({ order, updated_at: new Date() });
      }
    });

    if (!options?.skipCache) {
      await this.invalidateListCache(projectId);
      const cache = this.getCache();
      for (const { id } of flowOrders) {
        await cache.del(this.getCacheKey(id));
      }
    }
  }

  /**
   * Enable a flow
   */
  async enable(id: string, options?: RepositoryOptions): Promise<void> {
    await this.updateFlow(id, { enabled: true }, options);
  }

  /**
   * Disable a flow
   */
  async disable(id: string, options?: RepositoryOptions): Promise<void> {
    await this.updateFlow(id, { enabled: false }, options);
  }
}

// Export singleton instance
export const FlowRepository = new FlowRepositoryImpl();

export default FlowRepository;
