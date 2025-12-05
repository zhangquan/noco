-- =============================================
-- JSONB Model - Schema Storage Migration
-- Creates the table for storing schema definitions as JSONB
-- =============================================

-- Schema storage table
-- Stores table and column definitions with versioning support
CREATE TABLE IF NOT EXISTS jm_schema (
    id VARCHAR(26) PRIMARY KEY,              -- ULID primary key
    namespace VARCHAR(255) NOT NULL,         -- Namespace for multi-tenant support
    version INTEGER NOT NULL,                -- Schema version number
    schema JSONB NOT NULL DEFAULT '{}',      -- Schema data stored as JSONB
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for jm_schema
-- =============================================

-- Namespace index (critical for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_jm_schema_namespace 
ON jm_schema(namespace);

-- Composite index for version lookups
CREATE INDEX IF NOT EXISTS idx_jm_schema_namespace_version 
ON jm_schema(namespace, version DESC);

-- Unique constraint on namespace + version
CREATE UNIQUE INDEX IF NOT EXISTS idx_jm_schema_unique_version 
ON jm_schema(namespace, version);

-- GIN index for JSONB schema queries
CREATE INDEX IF NOT EXISTS idx_jm_schema_jsonb 
ON jm_schema USING GIN(schema);

-- =============================================
-- Trigger for auto-updating updated_at
-- =============================================

-- Apply trigger to jm_schema (reuses existing function)
DROP TRIGGER IF EXISTS trigger_jm_schema_updated_at ON jm_schema;
CREATE TRIGGER trigger_jm_schema_updated_at
    BEFORE UPDATE ON jm_schema
    FOR EACH ROW
    EXECUTE FUNCTION jm_update_timestamp();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE jm_schema IS 'Schema storage table - stores table and column definitions as JSONB with versioning';

COMMENT ON COLUMN jm_schema.id IS 'ULID primary key - globally unique, time-sortable';
COMMENT ON COLUMN jm_schema.namespace IS 'Namespace identifier - used for multi-tenant schema isolation';
COMMENT ON COLUMN jm_schema.version IS 'Schema version number - auto-incremented on each save';
COMMENT ON COLUMN jm_schema.schema IS 'JSONB column containing all table and column definitions';
