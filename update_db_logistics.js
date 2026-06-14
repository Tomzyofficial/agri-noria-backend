import pool from './src/lib/connect.js';
async function run() {
  await pool.query(`CREATE TABLE IF NOT EXISTS logistics_tickets (ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ticket_number VARCHAR(50) UNIQUE NOT NULL, batch_id UUID REFERENCES harvest_batches(batch_id) ON DELETE CASCADE, logistics_provider_id UUID REFERENCES vendors(id) ON DELETE CASCADE, destination TEXT NOT NULL, logistics_fee NUMERIC(15,2) NOT NULL, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT now());`);
  console.log('DB Updated');
  process.exit(0);
}
run();
