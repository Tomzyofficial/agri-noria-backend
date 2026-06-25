-- =====================================================
-- AGRINORIA — PRE-HARVEST & FORWARD CONTRACTS SCHEMA
-- =====================================================
-- These tables support the pre-harvest listing and
-- forward contract (pre-order) workflows between
-- cluster supervisors and ecosystem buyers.
-- =====================================================

-- PRE-HARVEST LISTINGS
-- Created by cluster supervisors to advertise upcoming harvests
CREATE TABLE IF NOT EXISTS pre_harvest_listings (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
   supervisor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
   program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
   commodity VARCHAR(255) NOT NULL,
   estimated_yield_tons DECIMAL(10,2) NOT NULL DEFAULT 0,
   offer_price_per_ton DECIMAL(15,2) NOT NULL DEFAULT 0,
   expected_harvest_date DATE,
   status VARCHAR(50) DEFAULT 'active', -- active, sold_out, cancelled, harvested
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FORWARD CONTRACTS (Pre-Orders / Escrow Deposits)
-- Created when a buyer places a pre-order on a pre-harvest listing
CREATE TABLE IF NOT EXISTS forward_contracts (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   buyer_id UUID NOT NULL, -- can be a buyer or an ecosystem vendor (exporter, off-taker, processor)
   pre_harvest_listing_id UUID REFERENCES pre_harvest_listings(id) ON DELETE CASCADE,
   quantity_tons DECIMAL(10,2) NOT NULL DEFAULT 0,
   total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
   escrow_status VARCHAR(50) DEFAULT 'pending_deposit', -- pending_deposit, deposited, released, refunded
   contract_status VARCHAR(50) DEFAULT 'pending_approval', -- pending_approval, approved, fulfilled, cancelled
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- INDEXES for Pre-Harvest & Forward Contracts
CREATE INDEX IF NOT EXISTS idx_pre_harvest_cluster ON pre_harvest_listings(cluster_id);
CREATE INDEX IF NOT EXISTS idx_pre_harvest_supervisor ON pre_harvest_listings(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_pre_harvest_status ON pre_harvest_listings(status);
CREATE INDEX IF NOT EXISTS idx_forward_contracts_buyer ON forward_contracts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_forward_contracts_listing ON forward_contracts(pre_harvest_listing_id);
CREATE INDEX IF NOT EXISTS idx_forward_contracts_escrow ON forward_contracts(escrow_status);

-- =====================================================
-- FARM SUPERVISIONS — IMAGE COLUMNS
-- =====================================================
-- Add image URL columns for each supervision stage
ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS clearing_image TEXT;
ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS irrigation_image TEXT;
ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS ridging_image TEXT;
ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS weeding_image TEXT;
ALTER TABLE farm_supervisions ADD COLUMN IF NOT EXISTS harvesting_image TEXT;

-- =====================================================
-- VENDOR WORKSPACE & ROLE COLUMNS
-- =====================================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS workspace CHARACTER VARYING;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS role CHARACTER VARYING;

-- =====================================================
-- VENDOR ONBOARDING COLUMNS
-- =====================================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS onboarding_level INTEGER DEFAULT 0;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'pending';
