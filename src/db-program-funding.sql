-- Program Wallets, Escrow Wallets, and Depletion Notifications Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS program_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_program_wallet UNIQUE (program_id, institution_id)
);

CREATE TABLE IF NOT EXISTS escrow_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    held_for_id UUID,
    held_for_type VARCHAR(50),
    amount DECIMAL(15,2) DEFAULT 0.00,
    conditions JSONB DEFAULT '{}'::jsonb,
    reference_id UUID,
    reference_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'held',
    created_at TIMESTAMPTZ DEFAULT now(),
    released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS program_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_wallets_program_id ON program_wallets(program_id);
CREATE INDEX IF NOT EXISTS idx_program_wallets_institution_id ON program_wallets(institution_id);
CREATE INDEX IF NOT EXISTS idx_program_notifications_recipient ON program_notifications(recipient_id, is_read);
