import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

const schema = `
CREATE TABLE IF NOT EXISTS buyer_ecosystem_orders (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   buyer_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
   total_amount DECIMAL(15,2) NOT NULL,
   status VARCHAR(50) DEFAULT 'pending',
   escrow_status VARCHAR(50) DEFAULT 'none',
   distributor_id UUID REFERENCES vendors(id),
   delivery_address TEXT,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyer_ecosystem_order_items (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   order_id UUID REFERENCES buyer_ecosystem_orders(id) ON DELETE CASCADE,
   product_id UUID,
   product_name VARCHAR(255),
   quantity INTEGER NOT NULL DEFAULT 1,
   price_per_unit DECIMAL(15,2) NOT NULL,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
