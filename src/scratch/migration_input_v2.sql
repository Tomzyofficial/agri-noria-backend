-- Migration: Update input_requests for Finance and Distribution flow
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS distributor_id UUID;
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS input_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS funds_status VARCHAR(50) DEFAULT 'pending'; -- pending, approved, rejected
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS items_status VARCHAR(50) DEFAULT 'pending'; -- pending, approved, rejected, assigned
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS is_cluster_request BOOLEAN DEFAULT false;

-- Ensure clusters have coordinates if not already present (checking pipeline-schema.sql it has region, let's add lat/long)
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10,7);
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(10,7);