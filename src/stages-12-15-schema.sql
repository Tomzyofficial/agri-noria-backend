-- Stage 12: Buyer/Offtaker Matching Schema
-- Stage 13: Sales & Settlement Schema
-- Stage 14: Repayment & Reconciliation Schema
-- Stage 15: Reporting & Intelligence Schema

-- ============ STAGE 12: BUYER/OFFTAKER MATCHING ============

CREATE TABLE IF NOT EXISTS buyer_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    commodity VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    unit VARCHAR(50) NOT NULL, -- kg, tons, bags, etc.
    estimated_quality VARCHAR(100),
    harvest_date DATE,
    location VARCHAR(255),
    available_from DATE,
    available_until DATE,
    traceability_verified BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active', -- active, in-negotiation, sold, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES buyer_marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES aggregator_buyers(id) ON DELETE CASCADE,
    offered_price DECIMAL(15,2) NOT NULL,
    quantity_offered DECIMAL(15,2),
    terms TEXT,
    contract_type VARCHAR(50), -- export, domestic, processing
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES buyer_marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES aggregator_buyers(id) ON DELETE CASCADE,
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    contract_terms TEXT,
    contract_price DECIMAL(15,2) NOT NULL,
    quantity_contracted DECIMAL(15,2) NOT NULL,
    delivery_date DATE,
    payment_terms VARCHAR(100),
    contract_pdf_url TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, fulfilled, disputed, cancelled
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============ STAGE 13: SALES & SETTLEMENT ============

DROP TABLE IF EXISTS sales CASCADE;
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES buyer_contracts(id) ON DELETE CASCADE,
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES aggregator_buyers(id) ON DELETE CASCADE,
    sale_amount DECIMAL(15,2) NOT NULL,
    quantity_sold DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, disputed
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    total_sales_value DECIMAL(15,2) NOT NULL,
    farmer_payout DECIMAL(15,2) NOT NULL,
    financing_recovery DECIMAL(15,2) DEFAULT 0.00,
    logistics_fees DECIMAL(15,2) DEFAULT 0.00,
    insurance_fees DECIMAL(15,2) DEFAULT 0.00,
    aggregator_commission DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending', -- pending, settled, disputed
    settlement_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_breakdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES sales_settlements(id) ON DELETE CASCADE,
    payout_type VARCHAR(50) NOT NULL, -- farmer, aggregator, logistics, insurance, financing
    recipient_id UUID REFERENCES vendors(id),
    amount DECIMAL(15,2) NOT NULL,
    wallet_credited_to UUID REFERENCES wallets(id),
    status VARCHAR(50) DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============ STAGE 14: REPAYMENT & RECONCILIATION ============

CREATE TABLE IF NOT EXISTS financing_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES buyer_agreements(id) ON DELETE CASCADE,
    original_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) DEFAULT 0.00,
    total_due DECIMAL(15,2) NOT NULL,
    amount_recovered DECIMAL(15,2) DEFAULT 0.00,
    repayment_status VARCHAR(50) DEFAULT 'pending', -- pending, partial, completed
    due_date DATE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repayment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repayment_id UUID NOT NULL REFERENCES financing_repayments(id) ON DELETE CASCADE,
    amount_paid DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50), -- sale_proceeds, direct_payment
    payment_date TIMESTAMP WITH TIME ZONE,
    reference_id UUID, -- Links to sales or direct payment
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    current_score DECIMAL(5,2) DEFAULT 0.00,
    max_score DECIMAL(5,2) DEFAULT 100.00,
    repayment_history_score DECIMAL(5,2) DEFAULT 0.00,
    yield_performance_score DECIMAL(5,2) DEFAULT 0.00,
    compliance_score DECIMAL(5,2) DEFAULT 0.00,
    payment_reliability_score DECIMAL(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============ STAGE 15: REPORTING & INTELLIGENCE ============

CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    total_transactions BIGINT DEFAULT 0,
    total_value DECIMAL(18,2) DEFAULT 0.00,
    total_farmers INTEGER DEFAULT 0,
    total_production DECIMAL(15,2) DEFAULT 0.00,
    average_yield DECIMAL(10,4) DEFAULT 0.00,
    repayment_rate DECIMAL(5,2) DEFAULT 0.00, -- percentage
    default_rate DECIMAL(5,2) DEFAULT 0.00,
    export_readiness_count INTEGER DEFAULT 0,
    cluster_performance_average DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yield_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    crop VARCHAR(255) NOT NULL,
    region VARCHAR(255),
    forecast_date DATE NOT NULL,
    expected_yield DECIMAL(15,2),
    confidence_level DECIMAL(5,2), -- percentage
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS climate_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region VARCHAR(255) NOT NULL,
    risk_type VARCHAR(50), -- drought, flood, pest, disease
    risk_level VARCHAR(50), -- low, medium, high
    affected_crops TEXT,
    forecast_period VARCHAR(100),
    mitigation_recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50), -- government, esg, financing
    period_start DATE,
    period_end DATE,
    total_farmers INTEGER,
    total_production DECIMAL(15,2),
    total_financing DECIMAL(18,2),
    repayment_performance DECIMAL(5,2),
    report_data JSONB,
    generated_by UUID REFERENCES vendors(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cluster_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    farmer_count INTEGER,
    production_volume DECIMAL(15,2),
    average_yield DECIMAL(10,4),
    input_adoption_rate DECIMAL(5,2),
    market_price_index DECIMAL(10,4),
    yield_variance DECIMAL(10,4),
    quality_score DECIMAL(5,2),
    logistics_efficiency DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============ INDEXES FOR PERFORMANCE ============

CREATE INDEX IF NOT EXISTS idx_buyer_listings_agg ON buyer_marketplace_listings(aggregator_id);
CREATE INDEX IF NOT EXISTS idx_buyer_listings_status ON buyer_marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_buyer_offers_listing ON buyer_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_buyer_contracts_agg ON buyer_contracts(aggregator_id);
CREATE INDEX IF NOT EXISTS idx_sales_contract ON sales(contract_id);
CREATE INDEX IF NOT EXISTS idx_settlements_sale ON sales_settlements(sale_id);
CREATE INDEX IF NOT EXISTS idx_repayments_agreement ON financing_repayments(agreement_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_vendor ON credit_scores(vendor_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_cluster_intel_date ON cluster_intelligence(metric_date);
