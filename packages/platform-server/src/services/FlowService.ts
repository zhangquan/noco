/**
 * Flow Service
 * Business logic for workflow/flow management
 * @module services/FlowService
 */

import { BaseService, type ServiceOptions } from './BaseService.js';
import { CacheScope, MetaTable } from '../types/index.js';
import type { Flow, FlowTriggerType, AnalysisType } from '../types/index.js';
import { NotFoundError } from '../errors/index.js';
import { ProjectService } from './ProjectService.js';
import {
  isValidAnalysisType,
  getGroupIdForAnalysisType,
  getAnalysisTypeConfig,
} from '../config/analysisTeamConfig.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateFlowInput {
  project_id: string;
  title?: string;
  trigger_type?: FlowTriggerType;
  /** Analysis type - automatically assigns to the correct team group */
  analysis_type?: AnalysisType;
  /** Group ID - if not provided and analysis_type is set, will be auto-assigned based on team mapping */
  group_id?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateFlowInput {
  title?: string;
  trigger_type?: FlowTriggerType;
  /** Analysis type - automatically assigns to the correct team group */
  analysis_type?: AnalysisType | null;
  enabled?: boolean;
  order?: number;
  /** Group ID - if analysis_type is set, this will be overridden */
  group_id?: string | null;
  fk_schema_id?: string;
  meta?: Record<string, unknown>;
}

export interface ReorderItem {
  id: string;
  order: number;
}

// ============================================================================
// Flow Service Class
// ============================================================================

class FlowServiceImpl extends BaseService<Flow> {
  protected tableName = MetaTable.FLOWS;
  protected cacheScope = CacheScope.FLOW;
  protected entityName = 'Flow';

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * List flows for a project
   */
  async listForProject(projectId: string, groupId?: string, options?: ServiceOptions): Promise<Flow[]> {
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
   * List enabled flows for a project
   */
  async listEnabled(projectId: string, options?: ServiceOptions): Promise<Flow[]> {
    return this.findMany({
      ...options,
      where: { project_id: projectId, enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * List flows by trigger type
   */
  async listByTrigger(
    projectId: string,
    triggerType: FlowTriggerType,
    options?: ServiceOptions
  ): Promise<Flow[]> {
    return this.findMany({
      ...options,
      where: { project_id: projectId, trigger_type: triggerType, enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  // ============================================================================
  // Flow Management
  // ============================================================================

  /**
   * Create a new flow
   * 
   * If analysis_type is provided:
   * - The flow will be automatically assigned to the correct team group
   * - If title is not provided, uses the analysis type's default title
   * 
   * Team mapping:
   * - 趋势分析 (trend) → 研究团队 (research)
   * - 风险分析 (risk) → 交易决策团队 (trading_decision)
   * - 最终决策 (final_decision) → 交易决策团队 (trading_decision)
   */
  async createFlow(input: CreateFlowInput, options?: ServiceOptions): Promise<Flow> {
    // Verify project exists
    await ProjectService.getByIdOrFail(input.project_id, options);

    // Handle analysis type - automatically assign to team group
    let groupId = input.group_id;
    let title = input.title;
    let analysisType: AnalysisType | undefined = input.analysis_type;

    if (analysisType && isValidAnalysisType(analysisType)) {
      // Automatically assign to the correct team group based on analysis type
      groupId = getGroupIdForAnalysisType(analysisType);
      
      // Use default title from analysis type config if not provided
      if (!title) {
        const config = getAnalysisTypeConfig(analysisType);
        title = config.defaultTitle || config.name;
      }
    }

    // Ensure title is provided
    if (!title) {
      title = '新流程';
    }

    // Get max order for the group
    const maxOrder = await this.getMaxOrder(input.project_id, groupId, options);

    return this.create({
      project_id: input.project_id,
      title: title.trim(),
      trigger_type: input.trigger_type || 'manual',
      analysis_type: analysisType,
      enabled: false,
      group_id: groupId,
      order: maxOrder + 1,
      meta: input.meta,
    } as Partial<Flow>, options);
  }

  /**
   * Update a flow
   * 
   * If analysis_type is changed:
   * - The flow will be automatically moved to the correct team group
   * 
   * Team mapping:
   * - 趋势分析 (trend) → 研究团队 (research)
   * - 风险分析 (risk) → 交易决策团队 (trading_decision)
   * - 最终决策 (final_decision) → 交易决策团队 (trading_decision)
   */
  async updateFlow(id: string, input: UpdateFlowInput, options?: ServiceOptions): Promise<Flow> {
    const updateData: Partial<Flow> = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.fk_schema_id !== undefined) updateData.fk_schema_id = input.fk_schema_id;
    if (input.meta !== undefined) updateData.meta = input.meta;

    // Handle analysis type - automatically update team group
    if (input.analysis_type !== undefined) {
      if (input.analysis_type === null) {
        // Clearing analysis type
        updateData.analysis_type = undefined;
        // Use explicit group_id if provided, otherwise keep current
        if (input.group_id !== undefined) {
          updateData.group_id = input.group_id || undefined;
        }
      } else if (isValidAnalysisType(input.analysis_type)) {
        // Setting analysis type - auto-assign to team group
        updateData.analysis_type = input.analysis_type;
        updateData.group_id = getGroupIdForAnalysisType(input.analysis_type);
      }
    } else if (input.group_id !== undefined) {
      // Only update group_id if analysis_type is not being changed
      updateData.group_id = input.group_id || undefined;
    }

    return this.update(id, updateData, options);
  }

  /**
   * Save flow (update meta/schema)
   */
  async saveFlow(
    id: string,
    input: {
      title?: string;
      trigger_type?: FlowTriggerType;
      enabled?: boolean;
      meta?: Record<string, unknown>;
    },
    options?: ServiceOptions
  ): Promise<Flow> {
    const updateData: Partial<Flow> = {};

    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.meta !== undefined) updateData.meta = input.meta;

    return this.update(id, updateData, options);
  }

  /**
   * Delete a flow
   */
  async deleteFlow(id: string, options?: ServiceOptions): Promise<boolean> {
    return this.delete(id, options);
  }

  /**
   * Enable a flow
   */
  async enable(id: string, options?: ServiceOptions): Promise<Flow> {
    return this.update(id, { enabled: true } as Partial<Flow>, options);
  }

  /**
   * Disable a flow
   */
  async disable(id: string, options?: ServiceOptions): Promise<Flow> {
    return this.update(id, { enabled: false } as Partial<Flow>, options);
  }

  /**
   * Publish a flow (copy dev schema to publish schema)
   */
  async publish(id: string, options?: ServiceOptions): Promise<Flow> {
    const flow = await this.getByIdOrFail(id, options);

    // Copy schema reference from dev to publish
    return this.update(id, {
      fk_publish_schema_id: flow.fk_schema_id,
      enabled: true,
    } as Partial<Flow>, options);
  }

  /**
   * Reorder flows
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
   * Move flow to a group
   */
  async moveToGroup(id: string, groupId: string | null, options?: ServiceOptions): Promise<Flow> {
    const flow = await this.getByIdOrFail(id, options);
    
    // Get max order in target group
    const maxOrder = await this.getMaxOrder(flow.project_id, groupId || undefined, options);

    return this.update(id, {
      group_id: groupId || undefined,
      order: maxOrder + 1,
    } as Partial<Flow>, options);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get maximum order value for flows in a project/group
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
export const FlowService = new FlowServiceImpl();

export default FlowService;
