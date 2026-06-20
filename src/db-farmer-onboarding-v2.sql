-- Add missing columns to farmer_profiles
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS cooperative_name VARCHAR(255);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS farmer_group VARCHAR(255);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS association VARCHAR(255);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS primary_activity VARCHAR(255);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS household_size INTEGER;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS dependents INTEGER;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS nin VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS voter_id VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS passport_id VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS drivers_license VARCHAR(100);
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS id_front_url TEXT;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS id_back_url TEXT;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS live_selfie_url TEXT;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0;

-- Create farms table if not exists (or add columns if it does)
CREATE TABLE IF NOT EXISTS farms (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    farm_name VARCHAR(255),
    ownership_type VARCHAR(100),
    location_address TEXT,
    latitude VARCHAR(100),
    longitude VARCHAR(100),
    farm_size_hectares VARCHAR(100),
    boundary_polygon TEXT,
    boundary_file_url TEXT,
    land_title_url TEXT,
    lease_agreement_url TEXT,
    community_attestation_url TEXT,
    farm_entrance_photo_url TEXT,
    farm_interior_photo_url TEXT,
    crop_photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to farms if it already existed
ALTER TABLE farms ADD COLUMN IF NOT EXISTS farm_name VARCHAR(255);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS farm_size_hectares VARCHAR(100);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS boundary_polygon TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS boundary_file_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS land_title_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS lease_agreement_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS community_attestation_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS farm_entrance_photo_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS farm_interior_photo_url TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS crop_photo_url TEXT;

-- New tables
CREATE TABLE IF NOT EXISTS farm_productions (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,
    crop VARCHAR(255),
    variety VARCHAR(255),
    planting_date DATE,
    expected_harvest_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS historical_productions (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    season_name VARCHAR(255),
    crop VARCHAR(255),
    yield_amount VARCHAR(100),
    area_hectares VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mechanization_profiles (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    equipment_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS input_usage_profiles (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    seed_supplier VARCHAR(255),
    fertilizer_usage VARCHAR(255),
    agrochemical_usage VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_profiles (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    mobile_money VARCHAR(100),
    previous_agricultural_loan BOOLEAN DEFAULT FALSE,
    insurance_history BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_climate_profiles (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    climate_risk_score INTEGER DEFAULT 0,
    flood_risk_score INTEGER DEFAULT 0,
    drought_risk_score INTEGER DEFAULT 0,
    crop_risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
