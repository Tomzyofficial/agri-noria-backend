import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function alterTable() {
  const client = await pool.connect();
  try {
    await client.query(`
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

      ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
      ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_status VARCHAR(50) DEFAULT 'not_required';
      ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_confirmed_by UUID REFERENCES vendors(id);
      ALTER TABLE buyer_ecosystem_orders ADD COLUMN IF NOT EXISTS finance_confirmed_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE buyer_ecosystem_order_items 
      ALTER COLUMN quantity TYPE NUMERIC(10,2);

      CREATE INDEX IF NOT EXISTS idx_eco_orders_payment_status ON buyer_ecosystem_orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_eco_orders_finance_status ON buyer_ecosystem_orders(finance_status);
      CREATE INDEX IF NOT EXISTS idx_eco_payments_order ON buyer_ecosystem_order_payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_eco_payments_buyer ON buyer_ecosystem_order_payments(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_eco_payments_status ON buyer_ecosystem_order_payments(status);
      CREATE INDEX IF NOT EXISTS idx_eco_payments_reference ON buyer_ecosystem_order_payments(provider_reference);
    `);
    console.log("Successfully updated ecosystem order payment and finance columns");
  } catch (error) {
    console.error("Error altering table:", error);
  } finally {
    client.release();
    pool.end();
  }
}

alterTable();
