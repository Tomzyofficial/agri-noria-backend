-- Database Schema for Farmer Agricultural Identity (Onboarding)

CREATE TABLE IF NOT EXISTS farmer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Level 1: Basic Identity (Also in vendors but expanded here)
    middle_name VARCHAR(100),
    gender VARCHAR(20),
    dob DATE,
    
    -- Level 1: Organization
    cooperative_name VARCHAR(255),
    farmer_group VARCHAR(255),
    association VARCHAR(255),

    -- Level 1: Farming Profile
    years_of_experience INTEGER,
    primary_activity VARCHAR(100),

    -- Level 1: Household
    marital_status VARCHAR(50),
    household_size INTEGER,
    dependents INTEGER,
    
    -- ID Verification
    nin VARCHAR(50),
    voter_id VARCHAR(50),
    passport_id VARCHAR(50),
    drivers_license VARCHAR(50),
    id_front_url TEXT,
    id_back_url TEXT,
    live_selfie_url TEXT,
    facial_verified BOOLEAN DEFAULT false,

    trust_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    farm_name VARCHAR(255),
    ownership_type VARCHAR(50),
    location_address TEXT,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    farm_size_hectares NUMERIC(10,2),
    boundary_polygon TEXT, -- GeoJSON or WKT
    boundary_file_url TEXT, -- KML/GeoJSON upload
    
    land_title_url TEXT,
    lease_agreement_url TEXT,
    community_attestation_url TEXT,
    
    farm_entrance_photo_url TEXT,
    farm_interior_photo_url TEXT,
    crop_photo_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
    crop VARCHAR(100),
    variety VARCHAR(100),
    planting_date DATE,
    expected_harvest_date DATE,
    is_current_season BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historical_productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    season_name VARCHAR(100),
    crop VARCHAR(100),
    yield_amount NUMERIC(10,2),
    area_hectares NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mechanization_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    equipment_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS input_usage_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    seed_supplier VARCHAR(255),
    fertilizer_usage VARCHAR(255),
    agrochemical_usage VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    mobile_money VARCHAR(50),
    previous_agricultural_loan BOOLEAN DEFAULT false,
    insurance_history BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_climate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    climate_risk_score INTEGER,
    flood_risk_score INTEGER,
    drought_risk_score INTEGER,
    crop_risk_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
