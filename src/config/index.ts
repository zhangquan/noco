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
export const TABLE_DATA = 'nc_data';

/**
 * Record links table for relationships between records
 */
export const TABLE_LINKS = 'nc_record_links';

/**
 * @deprecated Use TABLE_LINKS instead
 */
export const TABLE_RELATIONS = TABLE_LINKS;

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
