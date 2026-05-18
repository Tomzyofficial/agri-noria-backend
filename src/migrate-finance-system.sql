-- Migration: Finance Wallet System and Improved Escrow
-- Date: 2026-05-14
-- This migration adds the finance wallet system and improves escrow handling

-- 1. Update escrow_payments table to track finance release
ALTER TABLE escrow_payments ADD COLUMN IF NOT EXISTS released_by_finance_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- 2. Create finance_wallets table
CREATE TABLE IF NOT EXISTS finance_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_user_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    held_in_escrow DECIMAL(15,2) DEFAULT 0.00,
    distributed DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'NGN',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create finance_wallet_transactions table
CREATE TABLE IF NOT EXISTS finance_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finance_wallet_id UUID NOT NULL REFERENCES finance_wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    agreement_id UUID REFERENCES buyer_agreements(id) ON DELETE SET NULL,
    related_wallet_id UUID REFERENCES wallets(id),
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create input_financing_locks table
CREATE TABLE IF NOT EXISTS input_financing_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    reference_id UUID,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    released_at TIMESTAMP WITH TIME ZONE
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_finance_wallets_user ON finance_wallets(finance_user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_wallet ON finance_wallet_transactions(finance_wallet_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_finance ON escrow_payments(released_by_finance_id);
CREATE INDEX IF NOT EXISTS idx_input_locks_wallet ON input_financing_locks(wallet_id);

-- 6. Initialize finance wallets for existing finance users
INSERT INTO finance_wallets (finance_user_id)
SELECT id FROM vendors 
WHERE account_type = 'Finance' OR account_type = 'finance'
ON CONFLICT DO NOTHING;

-- 7. Update escrow_payments status values if needed
UPDATE escrow_payments 
SET status = 'held' 
WHERE status IS NULL OR status = '';
