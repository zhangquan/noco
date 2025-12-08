/**
 * useFlows Hook
 * 
 * Hook for managing flow CRUD operations.
 */

import { useState, useCallback } from 'react';
import type { FlowType, FlowSchemaType, SchemaDataType, SchemaDomain } from '../types';

export interface UseFlowsOptions {
  /** API base URL */
  apiBaseUrl?: string;
  /** Initial flows */
  initialFlows?: FlowType[];
  /** Called when flows change */
  onFlowsChange?: (flows: FlowType[]) => void;
}

export interface UseFlowsResult {
  /** List of flows */
  flows: FlowType[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Fetch flows */
  fetchFlows: (appId: string) => Promise<void>;
  /** Create a new flow */
  createFlow: (flow: Partial<FlowType>) => Promise<FlowType>;
  /** Update a flow */
  updateFlow: (flowId: string, updates: Partial<FlowType>) => Promise<FlowType>;
  /** Delete a flow */
  deleteFlow: (flowId: string) => Promise<void>;
  /** Get flow schema */
  getFlowSchema: (flowId: string, published?: boolean) => Promise<FlowSchemaType | null>;
  /** Save flow schema */
  saveFlowSchema: (flowId: string, schema: FlowSchemaType) => Promise<void>;
  /** Publish flow */
  publishFlow: (flowId: string) => Promise<void>;
  /** Duplicate flow */
  duplicateFlow: (flowId: string) => Promise<FlowType>;
  /** Reorder flows */
  reorderFlows: (flowIds: string[]) => Promise<void>;
}

/**
 * Hook for managing flows
 */
export function useFlows(options: UseFlowsOptions = {}): UseFlowsResult {
  const { apiBaseUrl = '/api', initialFlows = [], onFlowsChange } = options;

  const [flows, setFlows] = useState<FlowType[]>(initialFlows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateFlows = useCallback(
    (newFlows: FlowType[]) => {
      setFlows(newFlows);
      onFlowsChange?.(newFlows);
    },
    [onFlowsChange]
  );

  const fetchFlows = useCallback(
    async (appId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows?appId=${appId}`);
        if (!response.ok) throw new Error('Failed to fetch flows');
        const data = await response.json();
        updateFlows(data.flows || data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, updateFlows]
  );

  const createFlow = useCallback(
    async (flow: Partial<FlowType>): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(flow),
        });
        if (!response.ok) throw new Error('Failed to create flow');
        const newFlow = await response.json();
        updateFlows([...flows, newFlow]);
        return newFlow;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const updateFlow = useCallback(
    async (flowId: string, updates: Partial<FlowType>): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/${flowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update flow');
        const updatedFlow = await response.json();
        updateFlows(flows.map((f) => (f.id === flowId ? updatedFlow : f)));
        return updatedFlow;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const deleteFlow = useCallback(
    async (flowId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/${flowId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete flow');
        updateFlows(flows.filter((f) => f.id !== flowId));
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const getFlowSchema = useCallback(
    async (flowId: string, published = false): Promise<FlowSchemaType | null> => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = published
          ? `${apiBaseUrl}/flows/${flowId}/schema/published`
          : `${apiBaseUrl}/flows/${flowId}/schema`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to fetch flow schema');
        }
        const data = await response.json();
        return data.data as FlowSchemaType;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  const saveFlowSchema = useCallback(
    async (flowId: string, schema: FlowSchemaType): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/${flowId}/schema`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: schema }),
        });
        if (!response.ok) throw new Error('Failed to save flow schema');
        
        // Update local flow to indicate needs publishing
        updateFlows(
          flows.map((f) =>
            f.id === flowId ? { ...f, need_publish: true } : f
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const publishFlow = useCallback(
    async (flowId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/${flowId}/publish`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to publish flow');
        
        // Update local flow
        updateFlows(
          flows.map((f) =>
            f.id === flowId
              ? { ...f, is_publish: true, need_publish: false, publish_at: new Date() }
              : f
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const duplicateFlow = useCallback(
    async (flowId: string): Promise<FlowType> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/${flowId}/duplicate`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to duplicate flow');
        const newFlow = await response.json();
        updateFlows([...flows, newFlow]);
        return newFlow;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  const reorderFlows = useCallback(
    async (flowIds: string[]): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flows/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowIds }),
        });
        if (!response.ok) throw new Error('Failed to reorder flows');
        
        // Reorder local flows
        const reorderedFlows = flowIds
          .map((id, index) => {
            const flow = flows.find((f) => f.id === id);
            return flow ? { ...flow, order: index } : null;
          })
          .filter((f): f is FlowType => f !== null);
        
        updateFlows(reorderedFlows);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, flows, updateFlows]
  );

  return {
    flows,
    loading,
    error,
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    getFlowSchema,
    saveFlowSchema,
    publishFlow,
    duplicateFlow,
    reorderFlows,
  };
}
