/**
 * Schema Entity
 * Pure domain entity for schema with JSON Patch support
 * @module models/Schema
 */

import type { SchemaDomain, SchemaEnv } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * JSON Patch operation types (RFC 6902)
 */
export type JsonPatchOp = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

/**
 * JSON Patch operation (RFC 6902)
 */
export interface JsonPatchOperation {
  /** Operation type */
  op: JsonPatchOp;
  /** Target path (JSON Pointer) */
  path: string;
  /** Value for add/replace/test operations */
  value?: unknown;
  /** Source path for move/copy operations */
  from?: string;
}

/**
 * Schema data record
 */
export interface SchemaRecord {
  id: string;
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data: Record<string, unknown>;
  env: SchemaEnv;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Schema create options
 */
export interface SchemaCreateOptions {
  domain: SchemaDomain;
  fk_domain_id: string;
  fk_project_id: string;
  data?: Record<string, unknown>;
  env?: SchemaEnv;
}

/**
 * Schema patch result
 */
export interface SchemaPatchResult {
  appliedPatches: JsonPatchOperation[];
  newData: Record<string, unknown>;
  newVersion: number;
}

// ============================================================================
// Schema Entity Class
// ============================================================================

/**
 * Schema entity class - represents a schema in the system
 * Contains JSON Patch operations as business logic
 */
export class Schema {
  private _data: SchemaRecord;

  constructor(data: SchemaRecord) {
    this._data = data;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this._data.id; }
  get domain(): SchemaDomain { return this._data.domain; }
  get domainId(): string { return this._data.fk_domain_id; }
  get projectId(): string { return this._data.fk_project_id; }
  get data(): Record<string, unknown> { return this._data.data || {}; }
  get env(): SchemaEnv { return this._data.env; }
  get version(): number { return this._data.version || 1; }
  get createdAt(): Date { return this._data.created_at; }
  get updatedAt(): Date { return this._data.updated_at; }

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /**
   * Check if schema is DEV environment
   */
  get isDev(): boolean {
    return this.env === 'DEV';
  }

  /**
   * Check if schema is PRO (production) environment
   */
  get isPro(): boolean {
    return this.env === 'PRO';
  }

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get raw schema record
   */
  getData(): SchemaRecord {
    return { ...this._data };
  }

  /**
   * Convert to JSON
   */
  toJSON(): SchemaRecord {
    return this.getData();
  }

  // ==========================================================================
  // JSON Patch Operations (RFC 6902)
  // ==========================================================================

  /**
   * Apply JSON Patch operations to schema data (in memory)
   * Returns the result without persisting - use repository to save
   * @param patches - Array of JSON Patch operations
   * @returns Result with applied patches and new data
   */
  applyPatch(patches: JsonPatchOperation[]): SchemaPatchResult {
    const data = JSON.parse(JSON.stringify(this._data.data || {}));
    const appliedPatches: JsonPatchOperation[] = [];

    for (const patch of patches) {
      try {
        this.applyOperation(data, patch);
        appliedPatches.push(patch);
      } catch (error) {
        // If any patch fails, we stop and return what was applied
        console.error(`JSON Patch operation failed:`, patch, error);
        break;
      }
    }

    const newVersion = this.version + 1;

    // Update local data
    this._data.data = data;
    this._data.version = newVersion;
    this._data.updated_at = new Date();

    return { appliedPatches, newData: data, newVersion };
  }

  /**
   * Apply a single JSON Patch operation to an object
   */
  private applyOperation(obj: Record<string, unknown>, patch: JsonPatchOperation): void {
    const { op, path, value, from } = patch;

    switch (op) {
      case 'add':
        this.addValue(obj, path, value);
        break;
      case 'remove':
        this.removeValue(obj, path);
        break;
      case 'replace':
        this.replaceValue(obj, path, value);
        break;
      case 'move':
        if (!from) throw new Error('move operation requires "from" path');
        const moveValue = this.getValueAtPath(obj, from);
        this.removeValue(obj, from);
        this.addValue(obj, path, moveValue);
        break;
      case 'copy':
        if (!from) throw new Error('copy operation requires "from" path');
        const copyValue = this.getValueAtPath(obj, from);
        this.addValue(obj, path, JSON.parse(JSON.stringify(copyValue)));
        break;
      case 'test':
        const testValue = this.getValueAtPath(obj, path);
        if (JSON.stringify(testValue) !== JSON.stringify(value)) {
          throw new Error(`test operation failed at path: ${path}`);
        }
        break;
      default:
        throw new Error(`Unknown JSON Patch operation: ${op}`);
    }
  }

  /**
   * Parse JSON Pointer path to array of keys
   */
  private parsePath(path: string): string[] {
    if (path === '' || path === '/') return [];
    if (!path.startsWith('/')) {
      throw new Error(`Invalid JSON Pointer: ${path}`);
    }
    return path.slice(1).split('/').map(segment =>
      segment.replace(/~1/g, '/').replace(/~0/g, '~')
    );
  }

  /**
   * Get value at JSON Pointer path
   */
  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const keys = this.parsePath(path);
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        throw new Error(`Cannot access path: ${path}`);
      }
      if (Array.isArray(current)) {
        const index = key === '-' ? current.length : parseInt(key, 10);
        current = current[index];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        throw new Error(`Cannot access path: ${path}`);
      }
    }

    return current;
  }

  /**
   * Set value at JSON Pointer path
   */
  private setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot set root path');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        const index = parseInt(key, 10);
        current = current[index];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      } else {
        throw new Error(`Cannot set path: ${path}`);
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      const index = lastKey === '-' ? current.length : parseInt(lastKey, 10);
      current[index] = value;
    } else if (typeof current === 'object' && current !== null) {
      (current as Record<string, unknown>)[lastKey] = value;
    } else {
      throw new Error(`Cannot set path: ${path}`);
    }
  }

  /**
   * Add value at path (for 'add' operation)
   */
  private addValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot add at root path');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        current = current[parseInt(key, 10)];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      const index = lastKey === '-' ? current.length : parseInt(lastKey, 10);
      if (lastKey === '-') {
        current.push(value);
      } else {
        current.splice(index, 0, value);
      }
    } else if (typeof current === 'object' && current !== null) {
      (current as Record<string, unknown>)[lastKey] = value;
    }
  }

  /**
   * Remove value at path (for 'remove' operation)
   */
  private removeValue(obj: Record<string, unknown>, path: string): void {
    const keys = this.parsePath(path);
    if (keys.length === 0) {
      throw new Error('Cannot remove root');
    }

    let current: unknown = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (Array.isArray(current)) {
        current = current[parseInt(key, 10)];
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[key];
      }
    }

    const lastKey = keys[keys.length - 1];
    if (Array.isArray(current)) {
      current.splice(parseInt(lastKey, 10), 1);
    } else if (typeof current === 'object' && current !== null) {
      delete (current as Record<string, unknown>)[lastKey];
    }
  }

  /**
   * Replace value at path (for 'replace' operation)
   */
  private replaceValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    // First verify the path exists
    this.getValueAtPath(obj, path);
    // Then set the new value
    this.setValueAtPath(obj, path, value);
  }

  // ==========================================================================
  // Convenience Methods for Data Access
  // ==========================================================================

  /**
   * Get value at JSON Pointer path from schema data
   * @param path - JSON Pointer path (e.g., '/columns/0/title')
   * @returns Value at path or undefined
   */
  getAtPath<T = unknown>(path: string): T | undefined {
    try {
      return this.getValueAtPath(this._data.data || {}, path) as T;
    } catch {
      return undefined;
    }
  }

  // ==========================================================================
  // Update Methods
  // ==========================================================================

  /**
   * Update internal data (called after repository update)
   */
  setData(data: SchemaRecord): void {
    this._data = data;
  }

  /**
   * Update schema data (in memory)
   */
  updateData(data: Record<string, unknown>): void {
    this._data.data = data;
    this._data.version = this.version + 1;
    this._data.updated_at = new Date();
  }

  /**
   * Merge data into schema (shallow merge, in memory)
   */
  mergeData(data: Record<string, unknown>): void {
    this._data.data = { ...this._data.data, ...data };
    this._data.version = this.version + 1;
    this._data.updated_at = new Date();
  }

  // ==========================================================================
  // Static Utility Methods
  // ==========================================================================

  /**
   * Compare two data objects and generate patches
   */
  static diff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): JsonPatchOperation[] {
    return generateDiff(oldData, newData, '');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate JSON Patch operations from two objects
 * Simple diff implementation (not RFC 6902 compliant for all edge cases)
 */
function generateDiff(
  oldObj: unknown,
  newObj: unknown,
  path: string
): JsonPatchOperation[] {
  const patches: JsonPatchOperation[] = [];

  // Handle null/undefined
  if (oldObj === newObj) return patches;
  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      patches.push({ op: 'add', path: path || '/', value: newObj });
    }
    return patches;
  }
  if (newObj === null || newObj === undefined) {
    patches.push({ op: 'remove', path });
    return patches;
  }

  // Handle different types
  const oldType = Array.isArray(oldObj) ? 'array' : typeof oldObj;
  const newType = Array.isArray(newObj) ? 'array' : typeof newObj;

  if (oldType !== newType) {
    patches.push({ op: 'replace', path, value: newObj });
    return patches;
  }

  // Handle primitives
  if (oldType !== 'object' && oldType !== 'array') {
    if (oldObj !== newObj) {
      patches.push({ op: 'replace', path, value: newObj });
    }
    return patches;
  }

  // Handle arrays
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    // Simple array diff - replace if different
    if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      patches.push({ op: 'replace', path, value: newObj });
    }
    return patches;
  }

  // Handle objects
  const oldRecord = oldObj as Record<string, unknown>;
  const newRecord = newObj as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  for (const key of allKeys) {
    const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
    const childPath = path ? `${path}/${escapedKey}` : `/${escapedKey}`;

    if (!(key in oldRecord)) {
      patches.push({ op: 'add', path: childPath, value: newRecord[key] });
    } else if (!(key in newRecord)) {
      patches.push({ op: 'remove', path: childPath });
    } else {
      patches.push(...generateDiff(oldRecord[key], newRecord[key], childPath));
    }
  }

  return patches;
}

export default Schema;
