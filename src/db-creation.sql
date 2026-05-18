-- Account type (changed to character varying)
-- CREATE TYPE account_type AS ENUM ('Farmer', 'Seller', 'Logistics', 'Storage_Facility');
-- ALTER TYPE account_type OWNER TO postgres;

-- Vendor table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY default gen_random_uuid(),
  fname character varying NOT NULL,
  lname character varying NOT NULL,
  email character varying UNIQUE NOT NULL,
  phone character varying NOT NULL,
  account_type character varying NOT null,
  pword character varying not null,
  terms_of_service boolean not null,
  profile_image_url TEXT,
  is_active boolean DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_verified boolean DEFAULT false,
  onboarding_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, verified
  verified_at TIMESTAMP WITH TIME ZONE,
  is_suspended BOOLEAN DEFAULT false
);

-- Users table (core profile)
CREATE TABLE IF NOT EXISTS public.buyers (
    buyer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- nullable (only used for local login)
    name TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local', -- 'local', 'google', etc.
    google_id TEXT UNIQUE, -- nullable, filled only for Google users
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON buyers;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON buyers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS country_utils (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    user_id UUID REFERENCES buyers(buyer_id) ON DELETE CASCADE,
    country_name character varying NOT NULL,
    country_code character varying NOT NULL,
    state_code character varying NOT NULL,
    state_name character varying NOT NULL,
    currency character varying NOT NULL
);
-- not implemented yet
CREATE INDEX IF NOT EXISTS idx_country_utils_vendor_id ON country_utils(vendor_id);
CREATE INDEX IF NOT EXISTS idx_country_utils_user_id ON country_utils(user_id);


-- Trigger for automatically setting is_verified col in vendors table to true
CREATE OR REPLACE FUNCTION sync_vendor_verification()
RETURNS trigger AS $$
DECLARE
   all_approved boolean;
BEGIN
   SELECT NOT EXISTS (
      SELECT 1
      FROM vendor_documents
      WHERE vendor_id = NEW.vendor_id
      AND (
         id_front_status <> 'approved'
         OR id_back_status <> 'approved'
         OR license_status <> 'approved'
      )
   )
   INTO all_approved;

   UPDATE vendors
   SET is_verified = all_approved
   WHERE id = NEW.vendor_id;

   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vendor documents
CREATE TABLE IF NOT EXISTS vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    -- ID Card (Front),
	business_name TEXT,
		hot_line_phone_number TEXT,
	address TEXT,
		business_desc TEXT,
    id_front_url TEXT,
    id_front_status VARCHAR(20) DEFAULT 'pending' CHECK (id_front_status IN ('pending', 'approved', 'declined')),
    id_front_note TEXT,
    -- ID Card (Back)
    id_back_url TEXT,
    id_back_status VARCHAR(20) DEFAULT 'pending' CHECK (id_back_status IN ('pending', 'approved', 'declined')),
    id_back_note TEXT,
    -- Business License
    license_url TEXT,
    license_status VARCHAR(20) DEFAULT 'pending' CHECK (license_status IN ('pending', 'approved', 'declined')),
    license_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_sync_vendor_verification ON vendor_documents;
CREATE TRIGGER trg_sync_vendor_verification
AFTER UPDATE OF id_front_status, id_back_status, license_status
ON vendor_documents
FOR EACH ROW
EXECUTE FUNCTION sync_vendor_verification();



-- Vendor bank accounts
CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Vendor stats (simple aggregated data)
CREATE TABLE IF NOT EXISTS vendor_stats (
  vendor_id UUID PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
  total_listings INTEGER DEFAULT 0,
  total_sales NUMERIC(15,2) DEFAULT 0,
  rating NUMERIC(5,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY default gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  account_type character varying NOT NULL,
  product_image character varying not null,
  listing_name character varying NOT NULL,
  description character varying NOT NULL,
  price NUMERIC(15,2) NOT NULL,
  location character varying NOT NULL,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  product_status character varying not null DEFAULT 'active',
  unit_measure character varying NOT NULL,
  available_quantity NUMERIC NOT NULL,
  discount NUMERIC(5, 2),
  unit character varying NOT NULL,
  category character varying NOT NULL,
  min_quantity INTEGER,
  attributes JSONB
);



-- Customer table
CREATE TABLE IF NOT EXISTS buyer_orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES buyers(buyer_id) ON DELETE CASCADE,
    fname TEXT NOT NULL,
	 lname TEXT NOT NULL,
	 phone TEXT NOT NULL,
	 total_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',  -- e.g., pending, paid, shipped, delivered, cancelled
    payment_method VARCHAR(50),             -- e.g., 'card', 'bank transfer', 'cash on delivery'
    delivery_address TEXT NOT NULL,
    delivery_fee NUMERIC(15, 2) NOT NULL,
    vendor_fname TEXT NOT NULL,
    vendor_lname TEXT NOT NULL,
    vendor_phone TEXT NOT NULL,
    vendor_email TEXT NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    listing_id UUID NOT null REFERENCES listings(id),
    quantity INT NOT null
);

-- carts
CREATE TABLE IF NOT EXISTS carts (
   cart_id UUID default gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES buyers(buyer_id) on DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cart item
CREATE TABLE IF NOT EXISTS cart_items(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(cart_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    listing_name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    product_image TEXT NOT NULL,
    quantity INTEGER NOT NULL,
	listing_id UUID NOT NULL,
   country_code TEXT NOT NULL,
   currency TEXT NOT NULL,
   min_quantity INTEGER,
   discount NUMERIC(5,2),
	CONSTRAINT listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES buyers(buyer_id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)  
);

-- Billing cycle enum
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
      CREATE TYPE billing_cycle AS ENUM ('monthly', 'annually');
   END IF;
END$$;

-- Subscription status enum
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_type') THEN
      CREATE TYPE subscription_status_type AS ENUM (
          'active', 
          'success', 
          'complete', 
          'not_renewing',
          'cancelled',
          'past_due',
          'pending'
      );
   END IF;
END$$;

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id uuid PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    plan_name VARCHAR(100) NOT NULL,
    billing_cycle billing_cycle NOT NULL, -- Uses the custom ENUM type
    amount DECIMAL(10, 2) NOT NULL, 
    currency VARCHAR(3) DEFAULT 'NGN',
    paystack_plan_code VARCHAR(100) UNIQUE NOT NULL,
    features JSONB,
    popular BOOLEAN DEFAULT false
);


-- Paystack subscription events (for deferred webhook handling)
CREATE TABLE IF NOT EXISTS paystack_subscription_events (
    customer_code TEXT PRIMARY KEY,
    subscription_code TEXT NOT NULL,
    next_payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    card_account_name TEXT
);

-- Vendor subscriptions
CREATE TABLE IF NOT EXISTS vendor_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID,
    plan_id UUID,
    status subscription_status_type NOT NULL,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    will_not_renew_at TIMESTAMP,
    last4 TEXT,
    card_type TEXT,
    card_expires_month INTEGER,
    card_expires_year INTEGER,
    pending_plan_id UUID,
    plan_change_effective_date TIMESTAMP,
    disable_failed_at TIMESTAMP,
    paystack_authorization_code VARCHAR(100),
    paystack_customer_code VARCHAR(100),
    paystack_subscription_code VARCHAR(100),
    card_account_name TEXT,
    paystack_reference TEXT,
    CONSTRAINT vendor_sub_vendor_id_unique_key UNIQUE (vendor_id),
    CONSTRAINT vendor_sub_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    CONSTRAINT vendor_sub_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE,
    CONSTRAINT vendor_sub_pending_plan_id_fkey FOREIGN KEY (pending_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
);

-- Subscription invoices
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID,
    subscription_id UUID,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(20) NOT NULL,  
    paystack_reference VARCHAR(100) UNIQUE,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_invoices_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    CONSTRAINT subscription_invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES vendor_subscriptions(id) ON DELETE SET NULL
);

-- Transactions table (to track payment transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(100) NOT NULL UNIQUE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_vendor_id ON vendor_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_customer_code ON vendor_subscriptions(paystack_customer_code);
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_subscription_code ON vendor_subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_vendor_id ON subscription_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);



-- subscription plan seed. don't worry about this
INSERT INTO subscription_plans (plan_name, billing_cycle, amount, paystack_plan_code, features) VALUES
( 'Basic', 'monthly', 100.10, 'PLN_xeqv8q6pofsigpi', '{"products": 10, "analytics": "basic", "support": "email"}'::jsonb),
('Basic', 'annually', 969.50, 'PLN_m74ap2d4od9ydye', '{"products": 10, "analytics": "basic", "support": "email"}'::jsonb),
('Professional', 'monthly', 250.20, 'PLN_gauiayzfk95n6ly', '{"products": "unlimited", "analytics": "advanced", "support": "priority"}'::jsonb),
( 'Professional', 'annually', 1924.80, 'PLN_97qtqbs2szj4w6j', '{"products": "unlimited", "analytics": "advanced", "support": "priority"}'::jsonb),
('Enterprise', 'monthly', 500.00, 'PLN_f0mxwxq4rkfkz7u', '{"products": "unlimited", "analytics": "advanced", "support": "24/7"}'::jsonb),
('Enterprise', 'annually', 4800.00, 'PLN_2bkmehj457qh2bo', '{"products": "unlimited", "analytics": "advanced", "support": "24/7"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Subsidiaries tables

-- Storage table
CREATE TABLE IF NOT EXISTS storage_facility(
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   account_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
   storage_image CHARACTER VARYING NOT NULL,
   storage_name TEXT NOT NULL,
   href TEXT NOT NULL,
   storage_type TEXT NOT NULL,
   location TEXT NOT NULL,
   capacity TEXT NOT NULL,
   available TEXT NOT NULL,
   price NUMERIC(10,2) NOT NULL,
   temperature TEXT NOT NULL,
   description TEXT NOT NULL,
   status CHARACTER VARYING NOT NULL DEFAULT 'active',
   features TEXT[] NOT NULL,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
    org_name TEXT NOT NULL,
    years_in_operation INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    repay_amount NUMERIC(12,2),
    repay_period INTEGER NOT NULL, 
    monthly_revenue NUMERIC(12,2) NOT NULL,
    farm_size NUMERIC(10,2),
    primary_crop TEXT,
    inv_type TEXT,
    total_capacity INTEGER,
    current_utilization INTEGER,
    storage_type TEXT,
    farmers_served INTEGER,
   --  pending, approved, rejected, active
    status VARCHAR(20) DEFAULT 'pending', 
    supporting_doc TEXT NOT NULL,
    bank_statement TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interest_rate NUMERIC(5,2) DEFAULT 10.00,
    monthly_installment NUMERIC(12,2),
    amount_paid NUMERIC(12,2) DEFAULT 0,
    disbursed_at TIMESTAMP,
    approved_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS vendor_loan_idx ON loans(vendor_id);

-- Loan payments table
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    paystack_reference TEXT UNIQUE,
    payment_method TEXT DEFAULT 'paystack',
    paid_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- not yet created this
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_reference ON loan_payments(paystack_reference); 
