/**
 * Flow Serializer Utilities
 * Serialization and deserialization for flow schemas
 * @module utils/serializer
 */

import type {
  FlowSchema,
  NodeData,
  EdgeData,
} from '../types';
import { FlowGraph } from '../core/FlowGraph';
import { validateFlowSchema } from './validator';

// ============================================================================
// Serialization Options
// ============================================================================

export interface SerializeOptions {
  /** Include metadata */
  includeMeta?: boolean;
  /** Pretty print JSON */
  pretty?: boolean;
  /** Indent size for pretty printing */
  indent?: number;
  /** Exclude disabled nodes/edges */
  excludeDisabled?: boolean;
  /** Minify output */
  minify?: boolean;
}

export interface DeserializeOptions {
  /** Validate schema on load */
  validate?: boolean;
  /** Throw error on validation failure */
  strict?: boolean;
  /** Apply migrations for old schemas */
  migrate?: boolean;
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serialize a FlowGraph to JSON string
 */
export function serializeFlow(flow: FlowGraph, options: SerializeOptions = {}): string {
  const {
    includeMeta = true,
    pretty = true,
    indent = 2,
    excludeDisabled = false,
    minify = false,
  } = options;

  let schema = flow.toSchema();

  // Filter disabled nodes/edges if requested
  if (excludeDisabled) {
    schema = {
      ...schema,
      nodes: schema.nodes.filter(n => !n.disabled),
      edges: schema.edges.filter(e => !e.disabled),
    };
  }

  // Remove metadata if requested
  if (!includeMeta) {
    schema = {
      ...schema,
      meta: undefined,
      nodes: schema.nodes.map(n => ({ ...n, meta: undefined })),
      edges: schema.edges.map(e => ({ ...e, meta: undefined })),
    };
  }

  if (minify) {
    return JSON.stringify(schema);
  }

  return pretty
    ? JSON.stringify(schema, null, indent)
    : JSON.stringify(schema);
}

/**
 * Serialize a FlowGraph to a schema object
 */
export function serializeToSchema(flow: FlowGraph, options: SerializeOptions = {}): FlowSchema {
  const { excludeDisabled = false, includeMeta = true } = options;

  let schema = flow.toSchema();

  if (excludeDisabled) {
    schema = {
      ...schema,
      nodes: schema.nodes.filter(n => !n.disabled),
      edges: schema.edges.filter(e => !e.disabled),
    };
  }

  if (!includeMeta) {
    schema = {
      ...schema,
      meta: undefined,
      nodes: schema.nodes.map(n => ({ ...n, meta: undefined })),
      edges: schema.edges.map(e => ({ ...e, meta: undefined })),
    };
  }

  return schema;
}

/**
 * Deserialize JSON string to FlowGraph
 */
export function deserializeFlow(json: string, options: DeserializeOptions = {}): FlowGraph {
  const { validate = true, strict = false, migrate = true } = options;

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return deserializeFromSchema(data as FlowSchema, { validate, strict, migrate });
}

/**
 * Deserialize schema object to FlowGraph
 */
export function deserializeFromSchema(
  schema: FlowSchema,
  options: DeserializeOptions = {}
): FlowGraph {
  const { validate = true, strict = false, migrate = true } = options;

  // Apply migrations if needed
  let migratedSchema = schema;
  if (migrate) {
    migratedSchema = migrateSchema(schema);
  }

  // Validate schema
  if (validate) {
    const result = validateFlowSchema(migratedSchema);
    if (!result.success) {
      const errorMessage = result.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('\n');

      if (strict) {
        throw new Error(`Schema validation failed:\n${errorMessage}`);
      } else {
        console.warn('Schema validation warnings:', errorMessage);
      }
    }
  }

  return FlowGraph.fromSchema(migratedSchema);
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Schema version migrations
 */
const MIGRATIONS: Record<string, (schema: FlowSchema) => FlowSchema> = {
  // Migration from v0.x to v1.0.0
  '0.0.0': (schema) => {
    return {
      ...schema,
      version: '1.0.0',
    };
  },
};

/**
 * Migrate schema to latest version
 */
export function migrateSchema(schema: FlowSchema): FlowSchema {
  let current = schema;
  const currentVersion = schema.version || '0.0.0';

  // Apply migrations in order
  const sortedVersions = Object.keys(MIGRATIONS).sort(compareVersions);
  
  for (const version of sortedVersions) {
    if (compareVersions(currentVersion, version) <= 0) {
      const migration = MIGRATIONS[version];
      current = migration(current);
    }
  }

  return current;
}

/**
 * Compare semantic versions
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
}

// ============================================================================
// Import/Export Utilities
// ============================================================================

/**
 * Export flow as downloadable file content
 */
export function exportFlow(flow: FlowGraph, filename?: string): { content: string; filename: string } {
  const content = serializeFlow(flow, { pretty: true });
  const name = filename || `${flow.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.flow.json`;
  
  return { content, filename: name };
}

/**
 * Import flow from file content
 */
export function importFlow(content: string): FlowGraph {
  return deserializeFlow(content, { validate: true, strict: false, migrate: true });
}

/**
 * Export flow as base64 encoded string
 */
export function exportFlowBase64(flow: FlowGraph): string {
  const json = serializeFlow(flow, { minify: true });
  return Buffer.from(json).toString('base64');
}

/**
 * Import flow from base64 encoded string
 */
export function importFlowBase64(base64: string): FlowGraph {
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  return deserializeFlow(json);
}

// ============================================================================
// Partial Serialization
// ============================================================================

/**
 * Serialize only nodes (for partial export)
 */
export function serializeNodes(nodes: NodeData[]): string {
  return JSON.stringify(nodes, null, 2);
}

/**
 * Serialize only edges (for partial export)
 */
export function serializeEdges(edges: EdgeData[]): string {
  return JSON.stringify(edges, null, 2);
}

/**
 * Deserialize nodes from JSON
 */
export function deserializeNodes(json: string): NodeData[] {
  return JSON.parse(json) as NodeData[];
}

/**
 * Deserialize edges from JSON
 */
export function deserializeEdges(json: string): EdgeData[] {
  return JSON.parse(json) as EdgeData[];
}

// ============================================================================
// Clone Utilities
// ============================================================================

/**
 * Deep clone a flow schema
 */
export function cloneSchema(schema: FlowSchema): FlowSchema {
  return JSON.parse(JSON.stringify(schema));
}

/**
 * Deep clone a node
 */
export function cloneNode(node: NodeData): NodeData {
  return JSON.parse(JSON.stringify(node));
}

/**
 * Deep clone an edge
 */
export function cloneEdge(edge: EdgeData): EdgeData {
  return JSON.parse(JSON.stringify(edge));
}
