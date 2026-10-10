import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create storage_availability_schedules
    await client.query(`
      CREATE TABLE IF NOT EXISTS storage_availability_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id INT,
        vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        available_capacity_mt NUMERIC(15,2) NOT NULL DEFAULT 0,
        price_per_mt_month NUMERIC(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) DEFAULT 'available',
        accepted_commodities TEXT[] DEFAULT ARRAY['Maize', 'Rice', 'Soybeans', 'Wheat'],
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 2. Add columns to storage_facility
    await client.query(`
      ALTER TABLE storage_facility ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE storage_facility ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE storage_facility ADD COLUMN IF NOT EXISTS price_per_mt_month NUMERIC DEFAULT 0;
      ALTER TABLE storage_facility ADD COLUMN IF NOT EXISTS operating_days TEXT DEFAULT 'Mon - Sat';
    `);

    // 3. Add columns to vehicles
    await client.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS longitude NUMERIC;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS base_amount NUMERIC DEFAULT 0;
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS max_tons NUMERIC DEFAULT 0;
    `);

    // 4. Update vehicles max_tons from max_weight_kg if available
    await client.query(`
      UPDATE vehicles 
      SET max_tons = ROUND(max_weight_kg / 1000.0, 2) 
      WHERE (max_tons IS NULL OR max_tons = 0) AND max_weight_kg IS NOT NULL;
    `);

    // 5. Add columns to storage_tickets
    await client.query(`
      ALTER TABLE storage_tickets ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE storage_tickets ADD COLUMN IF NOT EXISTS end_date DATE;
    `);

    // 6. Add columns to logistics_tickets
    await client.query(`
      ALTER TABLE logistics_tickets ADD COLUMN IF NOT EXISTS vehicle_id INT;
      ALTER TABLE logistics_tickets ADD COLUMN IF NOT EXISTS vehicle_title TEXT;
      ALTER TABLE logistics_tickets ADD COLUMN IF NOT EXISTS pickup_location TEXT;
      ALTER TABLE logistics_tickets ADD COLUMN IF NOT EXISTS estimated_distance_km NUMERIC;
    `);

    await client.query("COMMIT");
    console.log("✅ Storage & Logistics migration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
