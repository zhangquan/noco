/**
 * useFlows Hook
 * Hook for managing flow CRUD operations
 * @module states/useFlows
 */

import { useState, useCallback } from 'react';
import type { FlowSchema, FlowTriggerType } from '@workspace/flow-designer';

// Flow entity type (from backend)
export interface FlowType {
  id: string;
  projectId: string;
  groupId?: string;
  title: string;
  schemaId?: string;
  publishSchemaId?: string;
  triggerType?: FlowTriggerType;
  enabled?: boolean;
  order?: number;
  meta?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// Types
// ============================================================================

export interface FlowApiConfig {
  /** Base URL for API calls */
  baseUrl: string;
  /** Project ID */
  projectId: string;
  /** Auth token */
  token?: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

export interface CreateFlowInput {
  title: string;
  triggerType?: FlowTriggerType;
  groupId?: string;
  meta?: Record<string, unknown>;
}

export interface UpdateFlowInput {
  title?: string;
  triggerType?: FlowTriggerType;
  enabled?: boolean;
  order?: number;
  groupId?: string | null;
  meta?: Record<string, unknown>;
}

export interface FlowListOptions {
  groupId?: string;
  enabled?: boolean;
  triggerType?: FlowTriggerType;
}

export interface UseFlowsResult {
  // State
  flows: FlowType[];
  loading: boolean;
  error: Error | null;

  // Actions
  fetchFlows: (options?: FlowListOptions) => Promise<void>;
  createFlow: (input: CreateFlowInput) => Promise<FlowType>;
  updateFlow: (flowId: string, input: UpdateFlowInput) => Promise<FlowType>;
  deleteFlow: (flowId: string) => Promise<void>;
  
  // Schema operations
  saveFlowSchema: (flowId: string, schema: FlowSchema) => Promise<void>;
  loadFlowSchema: (flowId: string) => Promise<FlowSchema | null>;
  
  // Flow actions
  publishFlow: (flowId: string) => Promise<FlowType>;
  enableFlow: (flowId: string) => Promise<FlowType>;
  disableFlow: (flowId: string) => Promise<FlowType>;
  reorderFlows: (orders: Array<{ id: string; order: number }>) => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing flows
 * @param config - API configuration
 */
export function useFlows(config: FlowApiConfig): UseFlowsResult {
  const [flows, setFlows] = useState<FlowType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    }
    return headers;
  }, [config.token, config.headers]);

  const apiCall = useCallback(
    async <T>(
      method: string,
      path: string,
      body?: unknown
    ): Promise<T> => {
      const url = `${config.baseUrl}/api/v1/db/meta/projects/${config.projectId}${path}`;
      
      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data as T;
    },
    [config.baseUrl, config.projectId, getHeaders]
  );

  // Fetch flows
  const fetchFlows = useCallback(
    async (options?: FlowListOptions) => {
      setLoading(true);
      setError(null);
      try {
        let path = '/flows';
        const params = new URLSearchParams();
        if (options?.groupId) params.set('groupId', options.groupId);
        if (options?.enabled !== undefined) params.set('enabled', String(options.enabled));
        if (options?.triggerType) params.set('triggerType', options.triggerType);
        
        if (params.toString()) {
          path += `?${params.toString()}`;
        }

        const result = await apiCall<FlowType[]>('GET', path);
        setFlows(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Create flow
  const createFlow = useCallback(
    async (input: CreateFlowInput): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall<FlowType>('POST', '/flows', {
          title: input.title,
          trigger_type: input.triggerType,
          group_id: input.groupId,
          meta: input.meta,
        });
        setFlows((prev) => [...prev, result]);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Update flow
  const updateFlow = useCallback(
    async (flowId: string, input: UpdateFlowInput): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall<FlowType>('PATCH', `/flows/${flowId}`, {
          title: input.title,
          trigger_type: input.triggerType,
          enabled: input.enabled,
          order: input.order,
          group_id: input.groupId,
          meta: input.meta,
        });
        setFlows((prev) =>
          prev.map((f) => (f.id === flowId ? result : f))
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Delete flow
  const deleteFlow = useCallback(
    async (flowId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiCall<void>('DELETE', `/flows/${flowId}`);
        setFlows((prev) => prev.filter((f) => f.id !== flowId));
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Save flow schema
  const saveFlowSchema = useCallback(
    async (flowId: string, schema: FlowSchema): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiCall<void>('POST', `/flows/${flowId}/save`, {
          meta: { schema },
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Load flow schema
  const loadFlowSchema = useCallback(
    async (flowId: string): Promise<FlowSchema | null> => {
      setLoading(true);
      setError(null);
      try {
        const flow = await apiCall<FlowType>('GET', `/flows/${flowId}`);
        return (flow.meta?.schema as FlowSchema) || null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Publish flow
  const publishFlow = useCallback(
    async (flowId: string): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall<FlowType>('POST', `/flows/${flowId}/publish`);
        setFlows((prev) =>
          prev.map((f) => (f.id === flowId ? result : f))
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Enable flow
  const enableFlow = useCallback(
    async (flowId: string): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall<FlowType>('POST', `/flows/${flowId}/enable`);
        setFlows((prev) =>
          prev.map((f) => (f.id === flowId ? result : f))
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Disable flow
  const disableFlow = useCallback(
    async (flowId: string): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiCall<FlowType>('POST', `/flows/${flowId}/disable`);
        setFlows((prev) =>
          prev.map((f) => (f.id === flowId ? result : f))
        );
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  // Reorder flows
  const reorderFlows = useCallback(
    async (orders: Array<{ id: string; order: number }>): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await apiCall<void>('POST', '/flows/reorder', { orders });
        setFlows((prev) =>
          prev
            .map((f) => {
              const orderItem = orders.find((o) => o.id === f.id);
              return orderItem ? { ...f, order: orderItem.order } : f;
            })
            .sort((a, b) => (a.order || 0) - (b.order || 0))
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  return {
    flows,
    loading,
    error,
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    saveFlowSchema,
    loadFlowSchema,
    publishFlow,
    enableFlow,
    disableFlow,
    reorderFlows,
  };
}

export default useFlows;
