-- =============================================
-- NocoDB DB Layer - Initial Migration
-- Creates the core tables for JSONB storage
-- =============================================

-- Main data table
-- Stores all user data in a JSONB column with system fields in dedicated columns
CREATE TABLE IF NOT EXISTS nc_bigtable (
    id VARCHAR(26) PRIMARY KEY,              -- ULID primary key
    fk_table_id VARCHAR(26) NOT NULL,        -- Table identifier for data isolation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(26),                  -- User ID who created the record
    updated_by VARCHAR(26),                  -- User ID who last updated the record
    data JSONB                               -- All user data stored as JSONB
);

-- Relations table (Many-to-Many junction table)
-- Stores MM relationships between records
CREATE TABLE IF NOT EXISTS nc_bigtable_relations (
    id VARCHAR(26) PRIMARY KEY,              -- ULID primary key
    fk_table_id VARCHAR(26) NOT NULL,        -- MM table identifier
    fk_parent_id VARCHAR(26),                -- Parent record ID
    fk_child_id VARCHAR(26),                 -- Child record ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for nc_bigtable
-- =============================================

-- Table ID index (critical for data isolation)
CREATE INDEX IF NOT EXISTS idx_nc_bigtable_table_id 
ON nc_bigtable(fk_table_id);

-- Composite index for common queries (table + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_nc_bigtable_table_created 
ON nc_bigtable(fk_table_id, created_at DESC);

-- Composite index for common queries (table + updated_at DESC)
CREATE INDEX IF NOT EXISTS idx_nc_bigtable_table_updated 
ON nc_bigtable(fk_table_id, updated_at DESC);

-- GIN index for JSONB data (supports @>, ?, ?& operators)
CREATE INDEX IF NOT EXISTS idx_nc_bigtable_data 
ON nc_bigtable USING GIN(data);

-- GIN index with jsonb_path_ops (smaller, faster, but limited operators)
CREATE INDEX IF NOT EXISTS idx_nc_bigtable_data_path_ops 
ON nc_bigtable USING GIN(data jsonb_path_ops);

-- =============================================
-- Indexes for nc_bigtable_relations
-- =============================================

-- Parent lookup index
CREATE INDEX IF NOT EXISTS idx_nc_relations_parent 
ON nc_bigtable_relations(fk_table_id, fk_parent_id);

-- Child lookup index
CREATE INDEX IF NOT EXISTS idx_nc_relations_child 
ON nc_bigtable_relations(fk_table_id, fk_child_id);

-- Composite index for relationship queries
CREATE INDEX IF NOT EXISTS idx_nc_relations_both 
ON nc_bigtable_relations(fk_table_id, fk_parent_id, fk_child_id);

-- Unique constraint to prevent duplicate relationships
CREATE UNIQUE INDEX IF NOT EXISTS idx_nc_relations_unique 
ON nc_bigtable_relations(fk_table_id, fk_parent_id, fk_child_id);

-- =============================================
-- Trigger for auto-updating updated_at
-- =============================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to nc_bigtable
DROP TRIGGER IF EXISTS trigger_nc_bigtable_updated_at ON nc_bigtable;
CREATE TRIGGER trigger_nc_bigtable_updated_at
    BEFORE UPDATE ON nc_bigtable
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to nc_bigtable_relations
DROP TRIGGER IF EXISTS trigger_nc_relations_updated_at ON nc_bigtable_relations;
CREATE TRIGGER trigger_nc_relations_updated_at
    BEFORE UPDATE ON nc_bigtable_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE nc_bigtable IS 'Main data table for NocoDB - stores all user data in JSONB format';
COMMENT ON TABLE nc_bigtable_relations IS 'Relations table for Many-to-Many relationships';

COMMENT ON COLUMN nc_bigtable.id IS 'ULID primary key - globally unique, time-sortable';
COMMENT ON COLUMN nc_bigtable.fk_table_id IS 'Table identifier - used for data isolation in single-table design';
COMMENT ON COLUMN nc_bigtable.data IS 'JSONB column containing all user-defined fields';

COMMENT ON COLUMN nc_bigtable_relations.fk_table_id IS 'MM junction table identifier';
COMMENT ON COLUMN nc_bigtable_relations.fk_parent_id IS 'Parent record ID in the MM relationship';
COMMENT ON COLUMN nc_bigtable_relations.fk_child_id IS 'Child record ID in the MM relationship';
