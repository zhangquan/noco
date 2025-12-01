/**
 * Configuration and constants for the database layer
 * @module config
 */

// ============================================================================
// Table Names
// ============================================================================

/**
 * Main data table for storing records as JSONB
 */
export const TABLE_DATA = 'nc_bigtable';

/**
 * Relations table for many-to-many links
 */
export const TABLE_RELATIONS = 'nc_bigtable_relations';

// ============================================================================
// Pagination Defaults
// ============================================================================

/**
 * Default pagination configuration
 */
export const PAGINATION = {
  /** Default limit when not specified */
  DEFAULT_LIMIT: 25,
  /** Minimum allowed limit */
  MIN_LIMIT: 1,
  /** Maximum allowed limit */
  MAX_LIMIT: 1000,
} as const;

// ============================================================================
// Bulk Operation Defaults
// ============================================================================

/**
 * Default bulk operation configuration
 */
export const BULK_OPERATIONS = {
  /** Default chunk size for bulk inserts/updates */
  DEFAULT_CHUNK_SIZE: 100,
  /** Maximum chunk size */
  MAX_CHUNK_SIZE: 1000,
} as const;

// ============================================================================
// Model Configuration Type
// ============================================================================

/**
 * Model configuration options
 */
export interface ModelConfig {
  /** Default limit for list queries */
  limitDefault: number;
  /** Minimum limit */
  limitMin: number;
  /** Maximum limit */
  limitMax: number;
}

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  limitDefault: PAGINATION.DEFAULT_LIMIT,
  limitMin: PAGINATION.MIN_LIMIT,
  limitMax: PAGINATION.MAX_LIMIT,
};
