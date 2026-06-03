import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

const schema = `
CREATE TABLE IF NOT EXISTS buyer_ecosystem_orders (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   buyer_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
   total_amount DECIMAL(15,2) NOT NULL,
   status VARCHAR(50) DEFAULT 'pending',
   payment_status VARCHAR(50) DEFAULT 'unpaid',
   finance_status VARCHAR(50) DEFAULT 'not_required',
   escrow_status VARCHAR(50) DEFAULT 'none',
   distributor_id UUID REFERENCES vendors(id),
   finance_confirmed_by UUID REFERENCES vendors(id),
   finance_confirmed_at TIMESTAMP WITH TIME ZONE,
   delivery_address TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_order_items (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   product_id UUID,
   product_name VARCHAR(255),
   quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
   price_per_unit DECIMAL(15,2) NOT NULL,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_order_payments (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID NOT NULL REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   buyer_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
   amount DECIMAL(15,2) NOT NULL,
   currency VARCHAR(10) DEFAULT 'NGN',
   payment_provider VARCHAR(50) DEFAULT 'paystack',
   provider_reference VARCHAR(255) UNIQUE,
   provider_payment_code VARCHAR(255),
   status VARCHAR(50) DEFAULT 'pending',
   finance_status VARCHAR(50) DEFAULT 'pending',
   finance_confirmed_by UUID REFERENCES vendors(id),
   finance_confirmed_at TIMESTAMP WITH TIME ZONE,
   finance_note TEXT,
   payment_method VARCHAR(50),
   metadata JSONB DEFAULT '{}',
   paid_at TIMESTAMP WITH TIME ZONE,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_escrow (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   buyer_id UUID REFERENCES vendors(id),
   amount DECIMAL(15,2) NOT NULL,
   payment_reference VARCHAR(255),
   status VARCHAR(50) DEFAULT 'held',
   held_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   released_at TIMESTAMP WITH TIME ZONE,
   released_by UUID REFERENCES vendors(id)
);

CREATE INDEX IF NOT EXISTS idx_eco_orders_buyer ON buyer_ecosystem_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_eco_orders_status ON buyer_ecosystem_orders(status);
CREATE INDEX IF NOT EXISTS idx_eco_orders_payment_status ON buyer_ecosystem_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_eco_orders_finance_status ON buyer_ecosystem_orders(finance_status);
CREATE INDEX IF NOT EXISTS idx_eco_payments_order ON buyer_ecosystem_order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_eco_payments_buyer ON buyer_ecosystem_order_payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_eco_payments_status ON buyer_ecosystem_order_payments(status);
CREATE INDEX IF NOT EXISTS idx_eco_payments_reference ON buyer_ecosystem_order_payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_eco_escrow_order ON buyer_ecosystem_escrow(order_id);

ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_status VARCHAR(50) DEFAULT 'not_required';
ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_confirmed_by UUID REFERENCES vendors(id);
ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE buyer_ecosystem_order_items ALTER COLUMN quantity TYPE NUMERIC(10,2);
`;

async function migrate() {
   try {
      await pool.query(schema);
      console.log('Ecosystem Buyer Tables created successfully');
   } catch (err) {
      console.error('Migration failed:', err);
   } finally {
      await pool.end();
   }
}

migrate();
