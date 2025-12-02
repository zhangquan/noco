-- =============================================
-- JSONB Model - Performance Indexes Migration
-- Optional indexes for specific use cases
-- =============================================

-- Note: These indexes are optional and should be created based on your specific query patterns.
-- Creating too many indexes can slow down write operations.

-- =============================================
-- Expression Indexes for Common JSONB Fields
-- =============================================

-- Example: Index on a specific field (replace 'status' with your field name)
-- CREATE INDEX IF NOT EXISTS idx_jm_data_status 
-- ON jm_data((data->>'status'))
-- WHERE table_id = 'your_table_id';

-- Example: Index on email field for user tables
-- CREATE INDEX IF NOT EXISTS idx_jm_data_email 
-- ON jm_data((data->>'email'))
-- WHERE table_id = 'users_table_id';

-- Example: Numeric field index with casting
-- CREATE INDEX IF NOT EXISTS idx_jm_data_amount 
-- ON jm_data((CAST(data->>'amount' AS NUMERIC)))
-- WHERE table_id = 'orders_table_id';

-- Example: Date field index
-- CREATE INDEX IF NOT EXISTS idx_jm_data_due_date 
-- ON jm_data((CAST(data->>'due_date' AS DATE)))
-- WHERE table_id = 'tasks_table_id';

-- =============================================
-- Full-Text Search Indexes
-- =============================================

-- Example: Full-text search on JSONB data (English)
-- CREATE INDEX IF NOT EXISTS idx_jm_data_fulltext 
-- ON jm_data USING GIN(to_tsvector('english', data::text))
-- WHERE table_id = 'searchable_table_id';

-- Example: Full-text search on specific field
-- CREATE INDEX IF NOT EXISTS idx_jm_data_title_fulltext 
-- ON jm_data USING GIN(to_tsvector('english', data->>'title'))
-- WHERE table_id = 'articles_table_id';

-- =============================================
-- Partial Indexes for Specific Conditions
-- =============================================

-- Example: Index only active records
-- CREATE INDEX IF NOT EXISTS idx_jm_data_active 
-- ON jm_data(table_id, created_at DESC)
-- WHERE data->>'status' = 'active';

-- Example: Index records from last 30 days
-- CREATE INDEX IF NOT EXISTS idx_jm_data_recent 
-- ON jm_data(table_id, created_at DESC)
-- WHERE created_at > NOW() - INTERVAL '30 days';

-- =============================================
-- BRIN Indexes for Time-Series Data
-- =============================================

-- BRIN indexes are smaller but work best with naturally ordered data
-- Good for append-only or time-series data

-- CREATE INDEX IF NOT EXISTS idx_jm_data_brin_created 
-- ON jm_data USING BRIN(created_at)
-- WHERE table_id = 'time_series_table_id';

-- =============================================
-- Hash Indexes for Equality Lookups
-- =============================================

-- Hash indexes are faster for equality lookups but don't support range queries
-- Only use if you're certain you only need equality lookups

-- CREATE INDEX IF NOT EXISTS idx_jm_data_hash_id 
-- ON jm_data USING HASH(id);

-- =============================================
-- Covering Indexes (Include non-key columns)
-- =============================================

-- Include frequently accessed columns to avoid table lookups
-- CREATE INDEX IF NOT EXISTS idx_jm_data_covering 
-- ON jm_data(table_id, id) 
-- INCLUDE (created_at, updated_at, data);

-- =============================================
-- Statistics Targets for Better Query Planning
-- =============================================

-- Increase statistics target for frequently queried columns
-- ALTER TABLE jm_data ALTER COLUMN table_id SET STATISTICS 1000;
-- ALTER TABLE jm_data ALTER COLUMN data SET STATISTICS 1000;

-- =============================================
-- Maintenance Commands (Run periodically)
-- =============================================

-- Analyze tables for query planner
-- ANALYZE jm_data;
-- ANALYZE jm_record_links;

-- Reindex if indexes become bloated
-- REINDEX TABLE CONCURRENTLY jm_data;
-- REINDEX TABLE CONCURRENTLY jm_record_links;

-- Vacuum to reclaim space and update statistics
-- VACUUM ANALYZE jm_data;
-- VACUUM ANALYZE jm_record_links;
