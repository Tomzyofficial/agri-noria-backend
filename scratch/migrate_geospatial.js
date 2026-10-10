import pool from "../src/lib/connect.js";

async function run() {
  try {
    await pool.query(`
      ALTER TABLE logistics_tickets 
      ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT,
      ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS delivery_geospatial_metadata JSONB,
      ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE storage_tickets 
      ADD COLUMN IF NOT EXISTS intake_proof_url TEXT,
      ADD COLUMN IF NOT EXISTS intake_latitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS intake_longitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS intake_geospatial_metadata JSONB,
      ADD COLUMN IF NOT EXISTS intake_verified_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE logistics_shipments
      ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC(10, 7),
      ADD COLUMN IF NOT EXISTS pickup_geospatial_metadata JSONB;

      ALTER TABLE farmer_profiles
      ADD COLUMN IF NOT EXISTS farm_evidence_geospatial JSONB;

      ALTER TABLE farms
      ADD COLUMN IF NOT EXISTS farm_evidence_geospatial JSONB;
    `);
    console.log("Geospatial columns added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
