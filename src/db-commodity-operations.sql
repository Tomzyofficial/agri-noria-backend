-- Commodity Operations Schema

-- 1. Harvest Batches
CREATE TABLE IF NOT EXISTS harvest_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    crop VARCHAR(100) NOT NULL,
    quantity_mt NUMERIC(15,2) NOT NULL,
    location VARCHAR(255) NOT NULL,
    harvest_date DATE NOT NULL,
    expected_grade VARCHAR(10),
    expected_moisture_pct NUMERIC(5,2),
    photos TEXT[],
    status VARCHAR(50) DEFAULT 'harvest_declared', -- harvest_declared, assessed, stored, in_transit, delivered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Commodity Assessments
CREATE TABLE IF NOT EXISTS commodity_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES vendors(id),
    actual_quantity_mt NUMERIC(15,2) NOT NULL,
    grade VARCHAR(10) NOT NULL,
    moisture_pct NUMERIC(5,2) NOT NULL,
    foreign_matter_pct NUMERIC(5,2) NOT NULL,
    inspection_result VARCHAR(20) CHECK (inspection_result IN ('PASS', 'FAIL')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Storage Tickets (Reservations)
CREATE TABLE IF NOT EXISTS storage_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    reserved_volume_mt NUMERIC(15,2) NOT NULL,
    storage_duration_days INT NOT NULL,
    storage_fee NUMERIC(15,2) NOT NULL,
    insurance_enabled BOOLEAN DEFAULT false,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'reserved', -- reserved, active, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Insurance Policies
CREATE TABLE IF NOT EXISTS insurance_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES vendors(id),
    coverage_types TEXT[], -- Loss, Fire, Flood, Theft, Transit Risk
    commodity_value NUMERIC(15,2) NOT NULL,
    coverage_amount NUMERIC(15,2) NOT NULL,
    premium_amount NUMERIC(15,2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active', -- active, closed, claimed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Inventory Positions
CREATE TABLE IF NOT EXISTS inventory_positions (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE UNIQUE,
    warehouse_id UUID REFERENCES vendors(id),
    current_quantity_mt NUMERIC(15,2) NOT NULL,
    market_value NUMERIC(15,2),
    buyer_id UUID REFERENCES buyers(buyer_id),
    status VARCHAR(50) DEFAULT 'Available', -- Available, Financed, Sold
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Commodity Operations Wallets
CREATE TABLE IF NOT EXISTS commodity_operations_wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE UNIQUE,
    total_finance_received NUMERIC(15,2) DEFAULT 0,
    allocated_storage NUMERIC(15,2) DEFAULT 0,
    allocated_insurance NUMERIC(15,2) DEFAULT 0,
    allocated_logistics NUMERIC(15,2) DEFAULT 0,
    farmer_advance NUMERIC(15,2) DEFAULT 0,
    balance NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Dispatch Requests
CREATE TABLE IF NOT EXISTS dispatch_requests (
    dispatch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES buyers(buyer_id),
    quantity_mt NUMERIC(15,2) NOT NULL,
    destination TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    delivery_window_hours INT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, loading, in_transit, delivered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7.5. Logistics Tickets
CREATE TABLE IF NOT EXISTS logistics_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    logistics_provider_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    destination TEXT NOT NULL,
    logistics_fee NUMERIC(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_transit, delivered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Transit Logs & Tracking
CREATE TABLE IF NOT EXISTS transit_logs (
    transit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transit_number VARCHAR(50) UNIQUE NOT NULL,
    dispatch_id UUID REFERENCES dispatch_requests(dispatch_id) ON DELETE CASCADE,
    transporter_id UUID REFERENCES vendors(id),
    vehicle_number VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    seal_number VARCHAR(100),
    current_location TEXT,
    eta TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'in_transit', -- in_transit, delivered, delayed
    departure_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Incidents
CREATE TABLE IF NOT EXISTS incidents (
    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE,
    reporter_id UUID,
    incident_type VARCHAR(50) NOT NULL, -- Theft, Accident, Spoilage, Flood, Fire, Quality Damage
    description TEXT,
    evidence_urls TEXT[],
    status VARCHAR(50) DEFAULT 'reported', -- reported, under_review, claimed, closed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Settlements
CREATE TABLE IF NOT EXISTS settlements (
    settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE UNIQUE,
    buyer_payment NUMERIC(15,2) DEFAULT 0,
    storage_deduction NUMERIC(15,2) DEFAULT 0,
    insurance_deduction NUMERIC(15,2) DEFAULT 0,
    logistics_deduction NUMERIC(15,2) DEFAULT 0,
    inventory_finance_deduction NUMERIC(15,2) DEFAULT 0,
    interest_deduction NUMERIC(15,2) DEFAULT 0,
    final_balance NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
