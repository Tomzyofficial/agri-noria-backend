DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_enclosure_type') THEN
         CREATE TYPE cargo _enclosure_type AS ENUM ('enclosed_box', 'open_bed', 'refrigerated');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pricing_model_type') THEN
        CREATE TYPE pricing_model_type AS ENUM ('flat_rate', 'per_km');
    END IF;
END $$;

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE, 
    title VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL, -- e.g., '5_ton_truck', 'mini_van'
    license_plate VARCHAR(50) NOT NULL UNIQUE,
    cargo_type cargo_enclosure_type NOT NULL,
    max_weight_kg INTEGER NOT NULL CHECK (max_weight_kg > 0),
    volume_cubic_meters NUMERIC(6, 2) CHECK (volume_cubic_meters > 0),
    base_location VARCHAR(150) NOT NULL,
    operating_regions TEXT[] NOT NULL, -- PostgreSQL array to store multiple states/zones
    pricing_model pricing_model_type NOT NULL,
    rate_amount NUMERIC(12, 2) NOT NULL CHECK (rate_amount >= 0),
    image TEXT[] DEFAULT '{}', -- Array of image URLs hosted on S3/Cloudinary
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_transit', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    public_id TEXT[]
);

-- Indexing for fast checkout queries based on capacity and operating zones
CREATE INDEX idx_vehicles_matching ON vehicles (status, max_weight_kg);
CREATE INDEX idx_vehicles_regions ON vehicles USING GIN (operating_regions);
CREATE INDEX idx_vehicles_vendor_id ON vehicles (vendor_id);
