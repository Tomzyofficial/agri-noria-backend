import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

const pool = new Pool({
   connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect'
});

async function runMigration() {
   try {
      const sql = `
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

         CREATE INDEX IF NOT EXISTS idx_eco_orders_buyer ON buyer_ecosystem_orders(buyer_id);
         CREATE INDEX IF NOT EXISTS idx_eco_orders_status ON buyer_ecosystem_orders(status);
         CREATE INDEX IF NOT EXISTS idx_eco_escrow_order ON buyer_ecosystem_escrow(order_id);

         CREATE TABLE IF NOT EXISTS marketplace_prices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            commodity VARCHAR(100) NOT NULL,
            current_price DECIMAL(15,2) NOT NULL,
            previous_price DECIMAL(15,2),
            unit VARCHAR(50) DEFAULT 'Ton',
            trend VARCHAR(20) DEFAULT 'stable',
            region VARCHAR(100),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
         );
      `;
      console.log('Running migration for buyer_ecosystem and marketplace tables...');
      await pool.query(sql);
      console.log('Migration completed successfully.');
   } catch (error) {
      console.error('Migration failed:', error);
   } finally {
      await pool.end();
   }
}

runMigration();
