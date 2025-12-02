-- =============================================
-- JSONB Model - Drop Tables Migration
-- Use with caution - this will delete all data
-- =============================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_jm_data_updated_at ON jm_data;

-- Drop trigger function
DROP FUNCTION IF EXISTS jm_update_timestamp();

-- Drop record links table
DROP TABLE IF EXISTS jm_record_links CASCADE;

-- Drop main data table
DROP TABLE IF EXISTS jm_data CASCADE;
