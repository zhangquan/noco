-- =============================================
-- JSONB Model - Initial Migration
-- Creates the core tables for JSONB storage
-- =============================================

-- Main data table
-- Stores all records with user data in a JSONB column
CREATE TABLE IF NOT EXISTS jm_data (
    id VARCHAR(26) PRIMARY KEY,              -- ULID primary key
    table_id VARCHAR(36) NOT NULL,           -- Table identifier for data isolation
    data JSONB NOT NULL DEFAULT '{}',        -- All user data stored as JSONB
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(36),                  -- User ID who created the record
    updated_by VARCHAR(36)                   -- User ID who last updated the record
);

-- Record links table
-- Stores relationships between records
CREATE TABLE IF NOT EXISTS jm_record_links (
    id VARCHAR(26) PRIMARY KEY,              -- ULID primary key
    source_record_id VARCHAR(26) NOT NULL,   -- Source record ID
    target_record_id VARCHAR(26) NOT NULL,   -- Target record ID
    link_field_id VARCHAR(36) NOT NULL,      -- Link field ID (defines the relationship)
    inverse_field_id VARCHAR(36),            -- Inverse field ID (for bidirectional links)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for jm_data
-- =============================================

-- Table ID index (critical for data isolation)
CREATE INDEX IF NOT EXISTS idx_jm_data_table_id 
ON jm_data(table_id);

-- Composite index for common queries (table + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_jm_data_table_created 
ON jm_data(table_id, created_at DESC);

-- Composite index for common queries (table + updated_at DESC)
CREATE INDEX IF NOT EXISTS idx_jm_data_table_updated 
ON jm_data(table_id, updated_at DESC);

-- GIN index for JSONB data (supports @>, ?, ?& operators)
CREATE INDEX IF NOT EXISTS idx_jm_data_jsonb 
ON jm_data USING GIN(data);

-- GIN index with jsonb_path_ops (smaller, faster for containment queries)
CREATE INDEX IF NOT EXISTS idx_jm_data_jsonb_path 
ON jm_data USING GIN(data jsonb_path_ops);

-- =============================================
-- Indexes for jm_record_links
-- =============================================

-- Find targets for a source record
CREATE INDEX IF NOT EXISTS idx_jm_links_source 
ON jm_record_links(link_field_id, source_record_id);

-- Find sources for a target record
CREATE INDEX IF NOT EXISTS idx_jm_links_target 
ON jm_record_links(link_field_id, target_record_id);

-- For cascade delete lookups
CREATE INDEX IF NOT EXISTS idx_jm_links_source_id 
ON jm_record_links(source_record_id);

CREATE INDEX IF NOT EXISTS idx_jm_links_target_id 
ON jm_record_links(target_record_id);

-- Prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_jm_links_unique 
ON jm_record_links(source_record_id, target_record_id, link_field_id);

-- =============================================
-- Trigger for auto-updating updated_at
-- =============================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION jm_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to jm_data
DROP TRIGGER IF EXISTS trigger_jm_data_updated_at ON jm_data;
CREATE TRIGGER trigger_jm_data_updated_at
    BEFORE UPDATE ON jm_data
    FOR EACH ROW
    EXECUTE FUNCTION jm_update_timestamp();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE jm_data IS 'Main data table - stores all records with user data in JSONB format';
COMMENT ON TABLE jm_record_links IS 'Record links table - stores relationships between records';

COMMENT ON COLUMN jm_data.id IS 'ULID primary key - globally unique, time-sortable';
COMMENT ON COLUMN jm_data.table_id IS 'Table identifier - used for data isolation in single-table design';
COMMENT ON COLUMN jm_data.data IS 'JSONB column containing all user-defined fields';

COMMENT ON COLUMN jm_record_links.source_record_id IS 'Source record ID - the record that initiates the link';
COMMENT ON COLUMN jm_record_links.target_record_id IS 'Target record ID - the record being linked to';
COMMENT ON COLUMN jm_record_links.link_field_id IS 'Link field ID - identifies which link field created this relation';
COMMENT ON COLUMN jm_record_links.inverse_field_id IS 'Inverse field ID - symmetric field on the target table (for bidirectional links)';
