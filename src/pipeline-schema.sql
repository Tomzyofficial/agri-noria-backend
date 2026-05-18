-- =====================================================
-- AGRINORIA EXECUTION PIPELINE — DATABASE SCHEMA
-- =====================================================

-- STAGE 1: PROGRAMS
CREATE TABLE IF NOT EXISTS programs (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name VARCHAR(255) NOT NULL,
   region VARCHAR(255) NOT NULL,
   commodity VARCHAR(255) NOT NULL,
   target_farmers INTEGER NOT NULL DEFAULT 0,
   target_hectares DECIMAL(12,2) NOT NULL DEFAULT 0,
   input_financing BOOLEAN DEFAULT false,
   harvest_financing BOOLEAN DEFAULT false,
   insurance_included BOOLEAN DEFAULT false,
   gps_verification_required BOOLEAN DEFAULT true,
   mid_season_inspection_required BOOLEAN DEFAULT true,
   harvest_audit_required BOOLEAN DEFAULT true,
   status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed, cancelled
   start_date DATE,
   end_date DATE,
   created_by UUID REFERENCES vendors(id),
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure start_date and end_date exist if the table was created previously without them
ALTER TABLE programs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS end_date DATE;

-- STAGE 2: FARMER PROFILES (extension of vendors)
CREATE TABLE IF NOT EXISTS farmer_profiles (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   vendor_id UUID UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
   national_id VARCHAR(100),
   cooperative VARCHAR(255),
   commodity VARCHAR(255),
   farm_size_hectares DECIMAL(10,2),
   experience_level VARCHAR(50), -- beginner, intermediate, advanced
   gps_latitude DECIMAL(10,7),
   gps_longitude DECIMAL(10,7),
   farm_image_url TEXT,
   program_id UUID REFERENCES programs(id),
   onboarding_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, verified
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 3: TRAINING MODULES
CREATE TABLE IF NOT EXISTS training_modules (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
   title VARCHAR(255) NOT NULL,
   description TEXT,
   format VARCHAR(50), -- video, voice, text
   language VARCHAR(50) DEFAULT 'english',
   offline_access BOOLEAN DEFAULT false,
   sort_order INTEGER DEFAULT 0,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farmer_training_progress (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE,
   status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
   score DECIMAL(5,2),
   completed_at TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   UNIQUE(farmer_id, module_id)
);

-- STAGE 4: CLUSTERS
CREATE TABLE IF NOT EXISTS clusters (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name VARCHAR(255) NOT NULL,
   program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
   supervisor_id UUID REFERENCES vendors(id), -- program manager / cluster supervisor
   region VARCHAR(255),
   total_hectares DECIMAL(12,2) DEFAULT 0,
   status VARCHAR(50) DEFAULT 'active', -- active, inactive
   gps_latitude DECIMAL(10,7),
   gps_longitude DECIMAL(10,7),
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cluster_members (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   role VARCHAR(50) DEFAULT 'farmer', -- farmer, field_officer
   assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   UNIQUE(cluster_id, farmer_id)
);

CREATE TABLE IF NOT EXISTS cluster_field_officers (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
   officer_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
   assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   UNIQUE(cluster_id, officer_id)
);

-- WALLETS (Farmer + Cluster)
CREATE TABLE IF NOT EXISTS wallets (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   owner_id UUID NOT NULL, -- can be vendor_id or cluster_id
   owner_type VARCHAR(50) NOT NULL, -- 'farmer', 'cluster'
   balance DECIMAL(15,2) DEFAULT 0.00,
   locked_balance DECIMAL(15,2) DEFAULT 0.00, -- for input financing (cant withdraw)
   currency VARCHAR(10) DEFAULT 'NGN',
   status VARCHAR(50) DEFAULT 'active',
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
   type VARCHAR(50) NOT NULL, -- credit, debit, transfer, input_financing, sales_deposit
   amount DECIMAL(15,2) NOT NULL,
   description TEXT,
   reference_id UUID, -- links to input_request, sale, etc.
   reference_type VARCHAR(50), -- input_request, sale, transfer
   from_wallet_id UUID REFERENCES wallets(id),
   to_wallet_id UUID REFERENCES wallets(id),
   status VARCHAR(50) DEFAULT 'completed',
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 5 & 6: INPUT REQUESTS & DISTRIBUTION
CREATE TABLE IF NOT EXISTS input_packages (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
   name VARCHAR(255) NOT NULL, -- e.g. "Cassava Package A"
   seeds BOOLEAN DEFAULT false,
   fertilizer BOOLEAN DEFAULT false,
   herbicides BOOLEAN DEFAULT false,
   total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS input_requests (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   package_id UUID REFERENCES input_packages(id),
   cluster_id UUID REFERENCES clusters(id),
   total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
   training_completed BOOLEAN DEFAULT false,
   gps_verified BOOLEAN DEFAULT false,
   cluster_approved BOOLEAN DEFAULT false,
   status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, distributed
   approved_by UUID REFERENCES vendors(id),
   approved_at TIMESTAMP WITH TIME ZONE,
   distributor_id UUID,
   input_items JSONB DEFAULT '[]'::jsonb,
   funds_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
   items_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, assigned
   is_cluster_request BOOLEAN DEFAULT false,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS input_distributions (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   request_id UUID REFERENCES input_requests(id) ON DELETE CASCADE,
   farmer_id UUID REFERENCES farmer_profiles(id),
   package_id UUID REFERENCES input_packages(id),
   delivery_status VARCHAR(50) DEFAULT 'assigned', -- assigned, in_transit, delivered
   farmer_signature BOOLEAN DEFAULT false,
   gps_confirmed BOOLEAN DEFAULT false,
   officer_authenticated BOOLEAN DEFAULT false,
   distributed_by UUID REFERENCES vendors(id),
   distribution_date TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 7: PLANTING EXECUTION
CREATE TABLE IF NOT EXISTS planting_activities (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   cluster_id UUID REFERENCES clusters(id),
   program_id UUID REFERENCES programs(id),
   land_cleared BOOLEAN DEFAULT false,
   inputs_received BOOLEAN DEFAULT false,
   planting_started BOOLEAN DEFAULT false,
   gps_captured BOOLEAN DEFAULT false,
   gps_latitude DECIMAL(10,7),
   gps_longitude DECIMAL(10,7),
   photo_urls TEXT[], -- array of uploaded photo URLs
   timestamp_verified BOOLEAN DEFAULT false,
   status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 8: FIELD VERIFICATION
CREATE TABLE IF NOT EXISTS field_verifications (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   officer_id UUID REFERENCES vendors(id),
   cluster_id UUID REFERENCES clusters(id),
   farm_visited BOOLEAN DEFAULT false,
   crop_verified BOOLEAN DEFAULT false,
   plant_density_checked BOOLEAN DEFAULT false,
   gps_match BOOLEAN DEFAULT false,
   timestamp_recorded TIMESTAMP WITH TIME ZONE,
   cluster_synced BOOLEAN DEFAULT false,
   status VARCHAR(50) DEFAULT 'pending', -- pending, verified, failed
   notes TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 9: CROP MONITORING
CREATE TABLE IF NOT EXISTS crop_monitoring (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   cluster_id UUID REFERENCES clusters(id),
   crop_health VARCHAR(50), -- healthy, at_risk, critical
   rainfall_status VARCHAR(100),
   satellite_status VARCHAR(100), -- vegetation_active, dormant
   ai_recommendation TEXT,
   risk_alerts TEXT[],
   monitoring_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 10: FARM SUPERVISIONS
CREATE TABLE IF NOT EXISTS farm_supervisions (
    id SERIAL PRIMARY KEY,
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    officer_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    
    clearing_status VARCHAR(20) DEFAULT 'pending',
    clearing_notes TEXT,
    clearing_updated_at TIMESTAMP,

    irrigation_status VARCHAR(20) DEFAULT 'pending',
    irrigation_notes TEXT,
    irrigation_updated_at TIMESTAMP,

    ridging_status VARCHAR(20) DEFAULT 'pending',
    ridging_notes TEXT,
    ridging_updated_at TIMESTAMP,

    weeding_status VARCHAR(20) DEFAULT 'pending',
    weeding_notes TEXT,
    weeding_updated_at TIMESTAMP,

    harvesting_status VARCHAR(20) DEFAULT 'pending',
    harvesting_notes TEXT,
    harvesting_updated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(farmer_id, program_id)
);

-- STAGE 10: MID-SEASON INSPECTIONS (uses field_verifications with type flag)

-- STAGE 11: HARVEST APPROVAL
CREATE TABLE IF NOT EXISTS harvest_approvals (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   cluster_id UUID REFERENCES clusters(id),
   expected_yield_tons DECIMAL(10,2),
   quality_status VARCHAR(50), -- export_grade, domestic_grade, rejected
   field_inspection BOOLEAN DEFAULT false,
   satellite_validation BOOLEAN DEFAULT false,
   moisture_test BOOLEAN DEFAULT false,
   status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
   approved_by UUID REFERENCES vendors(id),
   approved_at TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 12: AGGREGATION & LOGISTICS
CREATE TABLE IF NOT EXISTS logistics (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id),
   warehouse_name VARCHAR(255),
   truck_assignment VARCHAR(100),
   aggregated BOOLEAN DEFAULT false,
   weighed BOOLEAN DEFAULT false,
   weight_tons DECIMAL(10,2),
   in_transit BOOLEAN DEFAULT false,
   buyer_destination VARCHAR(255),
   status VARCHAR(50) DEFAULT 'pending', -- pending, aggregated, in_transit, delivered
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 13: BUYER/OFFTAKER MATCHING
CREATE TABLE IF NOT EXISTS buyer_matches (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id),
   logistics_id UUID REFERENCES logistics(id),
   commodity VARCHAR(255),
   quantity_tons DECIMAL(10,2),
   traceability_verified BOOLEAN DEFAULT false,
   buyer_name VARCHAR(255),
   buyer_type VARCHAR(100), -- exporter, processor, bulk_buyer
   contract_status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed
   offer_price DECIMAL(15,2),
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STAGE 14: SALES & SETTLEMENT
/* CREATE TABLE IF NOT EXISTS sales (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id),
   buyer_match_id UUID REFERENCES buyer_matches(id),
   total_sales_value DECIMAL(15,2) NOT NULL,
   farmer_payout DECIMAL(15,2) DEFAULT 0,
   financing_recovery DECIMAL(15,2) DEFAULT 0,
   logistics_fees DECIMAL(15,2) DEFAULT 0,
   insurance_fees DECIMAL(15,2) DEFAULT 0,
   status VARCHAR(50) DEFAULT 'pending', -- pending, settled, disputed
   disbursement_date TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
); */

-- STAGE 15: REPAYMENT & RECONCILIATION
CREATE TABLE IF NOT EXISTS repayments (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
   input_request_id UUID REFERENCES input_requests(id),
   financing_amount DECIMAL(15,2) NOT NULL,
   recovered_amount DECIMAL(15,2) DEFAULT 0,
   balance DECIMAL(15,2) DEFAULT 0,
   status VARCHAR(50) DEFAULT 'pending', -- pending, partial, completed
   credit_score_delta INTEGER DEFAULT 0,
   completed_at TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_vendor ON farmer_profiles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_farmer_profiles_program ON farmer_profiles(program_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_farmer ON cluster_members(farmer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_input_requests_farmer ON input_requests(farmer_id);
CREATE INDEX IF NOT EXISTS idx_planting_activities_farmer ON planting_activities(farmer_id);
CREATE INDEX IF NOT EXISTS idx_field_verifications_farmer ON field_verifications(farmer_id);
CREATE INDEX IF NOT EXISTS idx_harvest_approvals_farmer ON harvest_approvals(farmer_id);
-- CREATE INDEX IF NOT EXISTS idx_sales_cluster ON sales(cluster_id);
CREATE INDEX IF NOT EXISTS idx_repayments_farmer ON repayments(farmer_id);

-- SYSTEM TABLES (Audit & Scheduling)
CREATE TABLE IF NOT EXISTS audit_logs (
   id SERIAL PRIMARY KEY,
   user_id UUID REFERENCES vendors(id),
   user_email VARCHAR(255),
   action VARCHAR(50),
   resource VARCHAR(255),
   details TEXT,
   ip_address VARCHAR(45),
   timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visit_schedules (
   id SERIAL PRIMARY KEY,
   farm_id UUID REFERENCES farmer_profiles(id),
   farmer_id UUID REFERENCES vendors(id),
   visit_type VARCHAR(50),
   scheduled_date TIMESTAMP,
   officer_id UUID REFERENCES vendors(id),
   status VARCHAR(50) DEFAULT 'SCHEDULED',
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
   key VARCHAR(255) PRIMARY KEY,
   value JSONB,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- STAGE 16: BUYER/PARTNER ORDERS & ESCROW
CREATE TABLE IF NOT EXISTS buyer_ecosystem_orders (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   buyer_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
   total_amount DECIMAL(15,2) NOT NULL,
   status VARCHAR(50) DEFAULT 'pending', -- pending, paid, assigned, in_transit, delivered, cancelled
   escrow_status VARCHAR(50) DEFAULT 'none', -- none, held, released, refunded
   distributor_id UUID REFERENCES vendors(id),
   delivery_address TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_order_items (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   product_id UUID, 
   product_name VARCHAR(255),
   quantity INTEGER NOT NULL DEFAULT 1,
   price_per_unit DECIMAL(15,2) NOT NULL,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_escrow (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   buyer_id UUID REFERENCES vendors(id),
   amount DECIMAL(15,2) NOT NULL,
   payment_reference VARCHAR(255),
   status VARCHAR(50) DEFAULT 'held', -- held, released, refunded
   held_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   released_at TIMESTAMP WITH TIME ZONE,
   released_by UUID REFERENCES vendors(id)
);

-- INDEXES for Ecosystem Buyer Orders
CREATE INDEX IF NOT EXISTS idx_eco_orders_buyer ON buyer_ecosystem_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_eco_orders_status ON buyer_ecosystem_orders(status);
CREATE INDEX IF NOT EXISTS idx_eco_escrow_order ON buyer_ecosystem_escrow(order_id);

-- STAGE 17: MARKETPLACE DATA
CREATE TABLE IF NOT EXISTS marketplace_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity VARCHAR(100) NOT NULL,
    current_price DECIMAL(15,2) NOT NULL,
    previous_price DECIMAL(15,2),
    unit VARCHAR(50) DEFAULT 'Ton',
    trend VARCHAR(20) DEFAULT 'stable', -- up, down, stable
    region VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

