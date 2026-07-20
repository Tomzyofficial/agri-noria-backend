CREATE TABLE drone_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    -- Listing information
    listing_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(150),
    model VARCHAR(150),
    category VARCHAR(100),
    listing_type VARCHAR(20) NOT NULL CHECK (listing_type IN ('sale', 'rent', 'both')),
   location VARCHAR(100),
   quantity INTEGER,
   unit VARCHAR(50),
    description TEXT NOT NULL,
    -- Sale details
    sale_price DECIMAL(12,2),
    condition VARCHAR(50) DEFAULT 'new',
    warranty VARCHAR(50),
    -- Rental details
    rental_price DECIMAL(12,2),
    rental_period VARCHAR(50),
    -- Specifications
    max_payload VARCHAR(100),
    operating_range VARCHAR(100),
    camera_type TEXT,
    flight_time VARCHAR(100),
    -- Service details
   provide_service BOOLEAN DEFAULT FALSE,
   service_type TEXT,
    image TEXT[],
    public_id TEXT[],
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);