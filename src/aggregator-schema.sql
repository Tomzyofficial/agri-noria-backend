-- Aggregator specific tables
CREATE TABLE IF NOT EXISTS aggregator_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID UNIQUE NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    registration_details TEXT,
    company_logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aggregator_buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(50),
    company_name VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES aggregator_buyers(id) ON DELETE CASCADE,
    product_details JSONB NOT NULL, -- Includes commodity, quantity, price, location, etc.
    financing_amount DECIMAL(15,2) NOT NULL,
    is_pre_harvest BOOLEAN DEFAULT true, -- Scenario A vs Scenario B
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, signed, approved, paid, fulfilled, completed
    
    -- Agreement PDF details
    agreement_pdf_url TEXT,
    signed_pdf_url TEXT,
    secure_token VARCHAR(255) UNIQUE, -- Token for Link 1 (Acceptance)
    
    -- Payment details
    payment_token VARCHAR(255) UNIQUE, -- Token for Link 2 (Payment)
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, escrow, released
    paystack_reference VARCHAR(255),
    
    terms_and_conditions TEXT, -- Platform terms
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escrow_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id UUID NOT NULL REFERENCES buyer_agreements(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'held', -- held, released, refunded
    released_by_finance_id UUID REFERENCES vendors(id) ON DELETE SET NULL, -- Finance user who released
    released_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_user_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    held_in_escrow DECIMAL(15,2) DEFAULT 0.00, -- Amount held from escrow payments
    distributed DECIMAL(15,2) DEFAULT 0.00, -- Amount distributed to aggregators/clusters
    currency VARCHAR(10) DEFAULT 'NGN',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(finance_user_id)
);

CREATE TABLE IF NOT EXISTS finance_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_wallet_id UUID NOT NULL REFERENCES finance_wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- received_escrow, released_to_aggregator, released_to_cluster, transferred
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    agreement_id UUID REFERENCES buyer_agreements(id) ON DELETE SET NULL,
    related_wallet_id UUID REFERENCES wallets(id), -- For transfers to aggregator/cluster wallets
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aggregator_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregator_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    agreement_id UUID REFERENCES buyer_agreements(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    percentage DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Input financing locks (prevent withdrawal during input distribution phase)
CREATE TABLE IF NOT EXISTS input_financing_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(100) NOT NULL, -- 'input_distribution', 'financing_lock'
    reference_id UUID, -- Links to input_request or agreement
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    released_at TIMESTAMP WITH TIME ZONE
);

-- Add aggregator to owner_type in wallets if not already there (it's a varchar, so no need for check update unless there is one)
-- But we should ensure aggregator can have a wallet
INSERT INTO wallets (owner_id, owner_type)
SELECT id, 'aggregator' FROM vendors WHERE account_type = 'Aggregator'
ON CONFLICT DO NOTHING;

-- Initialize finance wallets for finance users
INSERT INTO finance_wallets (finance_user_id)
SELECT id FROM vendors WHERE account_type = 'Finance'
ON CONFLICT DO NOTHING;
