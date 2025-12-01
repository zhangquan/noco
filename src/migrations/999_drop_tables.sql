-- =============================================
-- NocoDB DB Layer - Drop Tables Migration
-- Use with caution - this will delete all data
-- =============================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_nc_bigtable_updated_at ON nc_bigtable;
DROP TRIGGER IF EXISTS trigger_nc_relations_updated_at ON nc_bigtable_relations;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop relations table (depends on nc_bigtable for referential integrity)
DROP TABLE IF EXISTS nc_bigtable_relations CASCADE;

-- Drop main table
DROP TABLE IF EXISTS nc_bigtable CASCADE;
