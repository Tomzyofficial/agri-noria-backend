CREATE TABLE IF NOT EXISTS marketplace_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES marketplace_wallets(id),

    -- 'credit'      -> money added from a confirmed order
    -- 'hold'        -> money moved from pending_balance is still pending (rarely needed, informational)
    -- 'release'     -> pending_balance -> balance (hold window expired)
    -- 'debit'       -> money removed because a withdrawal was requested
    -- 'reversal'    -> a withdrawal failed/was reversed, money returned to balance
    type VARCHAR(50) NOT NULL,

    amount DECIMAL(15,2) NOT NULL,

    -- snapshot of the wallet's `balance` AFTER this transaction was applied.
    -- Purely for audit/debugging — lets you eyeball history without recomputing.
    balance_after DECIMAL(15,2) NOT NULL,

    -- idempotency key. E.g. for a credit: 'credit_<order_payout_id>'
    -- for a debit: 'debit_<payout_request_id>'
    -- UNIQUE constraint means if your code accidentally runs twice
    -- (retry, double webhook, etc.) the second insert fails loudly
    -- instead of double-crediting silently.
    reference VARCHAR(255) NOT NULL UNIQUE,

    related_order_id UUID,        -- which order caused this (for credits)
    related_payout_request_id UUID, -- which withdrawal caused this (for debits/reversals)

    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    released BOOLEAN DEFAULT false,
    currency TEXT NOT NULL,
    country_code TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_wallet_transactions_wallet_id
    ON marketplace_wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_wallet_transactions_order_id
    ON marketplace_wallet_transactions(related_order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_wallet_transactions_unreleased_credits
  ON marketplace_wallet_transactions (created_at)
  WHERE type = 'credit' AND released = false;


CREATE TABLE IF NOT EXISTS marketplace_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES vendors(id),
    owner_type VARCHAR(50) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    pending_balance DECIMAL(15,2) DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_id UUID NOT NULL REFERENCES marketplace_wallets(id),
    owner_id UUID NOT NULL,     -- vendor_id or cluster_id, mirrors wallets.owner_id
    owner_type VARCHAR(50) NOT NULL,

    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',

    -- 'pending'     -> requested, not yet sent to Paystack
    -- 'processing'  -> Paystack transfer initiated, awaiting webhook/confirmation
    -- 'paid'        -> confirmed successful by Paystack
    -- 'failed'      -> Paystack rejected/errored, money reversed to wallet
    -- 'reversed'    -> explicitly reversed after being debited (admin action or failure)
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    bank_account_id UUID,  -- FK to your existing bank_accounts table
    account_name VARCHAR(255),
    account_number VARCHAR(20),
    bank_code VARCHAR(10),

    paystack_recipient_code VARCHAR(100),
    paystack_transfer_code VARCHAR(100),
    paystack_transfer_reference VARCHAR(255) UNIQUE, -- what YOU generate and send to Paystack

    failure_reason TEXT,

    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE, -- when Paystack confirmed success/failure

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_wallet_id
    ON payout_requests(wallet_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_status
    ON payout_requests(status);


CREATE TABLE IF NOT EXISTS payouts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    recipient_vendor_id UUID NOT NULL REFERENCES vendors(id),
    recipient_type VARCHAR(30) NOT NULL,
    payout_type VARCHAR(30) NOT NULL,

    gross_amount NUMERIC(12,2) NOT NULL, -- overall amount

    commission_amount NUMERIC(12,2) DEFAULT 0, -- platform commission

    net_amount NUMERIC(12,2) NOT NULL, -- actual amount to be paid out

    currency VARCHAR(10) NOT NULL,
    country_code VARCHAR(10) NOT NULL,

    status VARCHAR(30) DEFAULT 'pending',

    transfer_reference VARCHAR(255),

    transfer_response JSONB DEFAULT '{}',

    failure_reason TEXT,

    released_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()
);