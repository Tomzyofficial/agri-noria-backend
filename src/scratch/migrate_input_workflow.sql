-- Migration to support detailed input request workflow
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS requester_type VARCHAR(50); -- 'farmer', 'cluster_manager', 'aggregator'
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS requester_id UUID; -- references vendors.id or farmer_profiles.id
ALTER TABLE input_requests ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2) DEFAULT 0;

-- Sync entity profile fields
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Ensure input_items is JSONB
-- (Already JSONB in schema but just in case)

-- Indexing for distributor tasks
CREATE INDEX IF NOT EXISTS idx_input_requests_distributor ON input_requests(distributor_id);
CREATE INDEX IF NOT EXISTS idx_input_requests_status ON input_requests(status);
