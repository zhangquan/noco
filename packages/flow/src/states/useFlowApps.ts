/**
 * useFlowApps Hook
 * 
 * Hook for managing flow applications.
 */

import { useState, useCallback } from 'react';

export interface FlowApp {
  /** App ID */
  id: string;
  /** App name */
  name: string;
  /** App description */
  description?: string;
  /** Project ID */
  projectId: string;
  /** Created at */
  createdAt: string | Date;
  /** Updated at */
  updatedAt: string | Date;
  /** Flow count */
  flowCount?: number;
}

export interface UseFlowAppsOptions {
  /** API base URL */
  apiBaseUrl?: string;
  /** Initial apps */
  initialApps?: FlowApp[];
  /** Called when apps change */
  onAppsChange?: (apps: FlowApp[]) => void;
}

export interface UseFlowAppsResult {
  /** List of flow apps */
  apps: FlowApp[];
  /** Current selected app */
  currentApp: FlowApp | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Fetch apps */
  fetchApps: (projectId: string) => Promise<void>;
  /** Select an app */
  selectApp: (appId: string | null) => void;
  /** Create a new app */
  createApp: (app: Partial<FlowApp>) => Promise<FlowApp>;
  /** Update an app */
  updateApp: (appId: string, updates: Partial<FlowApp>) => Promise<FlowApp>;
  /** Delete an app */
  deleteApp: (appId: string) => Promise<void>;
}

/**
 * Hook for managing flow applications
 */
export function useFlowApps(options: UseFlowAppsOptions = {}): UseFlowAppsResult {
  const { apiBaseUrl = '/api', initialApps = [], onAppsChange } = options;

  const [apps, setApps] = useState<FlowApp[]>(initialApps);
  const [currentApp, setCurrentApp] = useState<FlowApp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateApps = useCallback(
    (newApps: FlowApp[]) => {
      setApps(newApps);
      onAppsChange?.(newApps);
    },
    [onAppsChange]
  );

  const fetchApps = useCallback(
    async (projectId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/projects/${projectId}/flow-apps`);
        if (!response.ok) throw new Error('Failed to fetch flow apps');
        const data = await response.json();
        updateApps(data.apps || data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, updateApps]
  );

  const selectApp = useCallback(
    (appId: string | null) => {
      if (appId === null) {
        setCurrentApp(null);
      } else {
        const app = apps.find((a) => a.id === appId) || null;
        setCurrentApp(app);
      }
    },
    [apps]
  );

  const createApp = useCallback(
    async (app: Partial<FlowApp>): Promise<FlowApp> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flow-apps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(app),
        });
        if (!response.ok) throw new Error('Failed to create flow app');
        const newApp = await response.json();
        updateApps([...apps, newApp]);
        return newApp;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apps, updateApps]
  );

  const updateApp = useCallback(
    async (appId: string, updates: Partial<FlowApp>): Promise<FlowApp> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flow-apps/${appId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error('Failed to update flow app');
        const updatedApp = await response.json();
        updateApps(apps.map((a) => (a.id === appId ? updatedApp : a)));
        if (currentApp?.id === appId) {
          setCurrentApp(updatedApp);
        }
        return updatedApp;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apps, currentApp, updateApps]
  );

  const deleteApp = useCallback(
    async (appId: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/flow-apps/${appId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete flow app');
        updateApps(apps.filter((a) => a.id !== appId));
        if (currentApp?.id === appId) {
          setCurrentApp(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apps, currentApp, updateApps]
  );

  return {
    apps,
    currentApp,
    loading,
    error,
    fetchApps,
    selectApp,
    createApp,
    updateApp,
    deleteApp,
  };
}
