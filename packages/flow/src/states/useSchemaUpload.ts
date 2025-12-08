/**
 * useSchemaUpload Hook
 * 
 * Hook for uploading/downloading flow schemas.
 */

import { useState, useCallback } from 'react';
import type { FlowSchemaType } from '../types';
import { validateSchema } from '../model/logic-model';

export interface UseSchemaUploadOptions {
  /** Called when schema is imported */
  onImport?: (schema: FlowSchemaType) => void;
  /** Called when import fails */
  onError?: (error: Error) => void;
}

export interface UseSchemaUploadResult {
  /** Whether upload is in progress */
  uploading: boolean;
  /** Error state */
  error: Error | null;
  /** Import schema from file */
  importFromFile: (file: File) => Promise<FlowSchemaType | null>;
  /** Import schema from JSON string */
  importFromJson: (json: string) => FlowSchemaType | null;
  /** Export schema to JSON string */
  exportToJson: (schema: FlowSchemaType, pretty?: boolean) => string;
  /** Export schema and download as file */
  downloadAsFile: (schema: FlowSchemaType, filename?: string) => void;
  /** Clear error */
  clearError: () => void;
}

/**
 * Hook for schema import/export
 */
export function useSchemaUpload(
  options: UseSchemaUploadOptions = {}
): UseSchemaUploadResult {
  const { onImport, onError } = options;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      onError?.(err);
    },
    [onError]
  );

  const importFromFile = useCallback(
    async (file: File): Promise<FlowSchemaType | null> => {
      setUploading(true);
      setError(null);

      try {
        // Validate file type
        if (!file.name.endsWith('.json')) {
          throw new Error('File must be a JSON file');
        }

        // Read file content
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });

        // Parse JSON
        const schema = JSON.parse(content) as FlowSchemaType;

        // Validate schema
        const validation = validateSchema(schema);
        if (!validation.valid) {
          throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
        }

        onImport?.(schema);
        return schema;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        handleError(error);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [handleError, onImport]
  );

  const importFromJson = useCallback(
    (json: string): FlowSchemaType | null => {
      setError(null);

      try {
        const schema = JSON.parse(json) as FlowSchemaType;

        // Validate schema
        const validation = validateSchema(schema);
        if (!validation.valid) {
          throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
        }

        onImport?.(schema);
        return schema;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        handleError(error);
        return null;
      }
    },
    [handleError, onImport]
  );

  const exportToJson = useCallback(
    (schema: FlowSchemaType, pretty = true): string => {
      return JSON.stringify(schema, null, pretty ? 2 : undefined);
    },
    []
  );

  const downloadAsFile = useCallback(
    (schema: FlowSchemaType, filename = 'flow-schema.json') => {
      const json = exportToJson(schema, true);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    },
    [exportToJson]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    uploading,
    error,
    importFromFile,
    importFromJson,
    exportToJson,
    downloadAsFile,
    clearError,
  };
}
