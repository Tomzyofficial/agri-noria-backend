CREATE TABLE IF NOT EXISTS program_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'NGN',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(program_id, institution_id)
);

CREATE TABLE IF NOT EXISTS escrow_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    held_for_id UUID NOT NULL, -- The Participant ID (Farmer, Cluster, Supplier)
    held_for_type VARCHAR(50) NOT NULL, -- 'farmer', 'cluster', 'supplier'
    amount DECIMAL(15,2) NOT NULL,
    conditions JSONB, -- E.g. {"input_delivered": false, "verified": true}
    status VARCHAR(50) DEFAULT 'held', -- held, released, refunded
    reference_id UUID, -- E.g. Input Request ID
    reference_type VARCHAR(50), -- E.g. 'input_request'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    released_at TIMESTAMP WITH TIME ZONE
);
