CREATE TABLE IF NOT EXISTS programme_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    date_recorded DATE DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES vendors(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, released, refunded
    transaction_type VARCHAR(50) DEFAULT 'disbursement', -- disbursement, recovery
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    commodity VARCHAR(255) NOT NULL,
    quantity_mt DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, fulfilled, cancelled
    delivery_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traceability_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    origin VARCHAR(255),
    destination VARCHAR(255),
    status VARCHAR(50) DEFAULT 'in_transit', -- origin, in_transit, delivered
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_by UUID REFERENCES vendors(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL,
    period_start DATE,
    period_end DATE,
    total_farmers INT,
    total_production DECIMAL(15,2),
    total_financing DECIMAL(15,2),
    repayment_performance DECIMAL(5,2),
    report_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extension_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    community VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    farmers_reached INT DEFAULT 0,
    date_conducted DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ngo_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    item_type VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    beneficiaries_count INT DEFAULT 0,
    distribution_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
