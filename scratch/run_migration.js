import pool from "../src/lib/connect.js";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("1. Adding registered_by column to vendors and farmer_profiles...");
    await client.query("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES vendors(id) ON DELETE SET NULL;");
    await client.query("ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES vendors(id) ON DELETE SET NULL;");

    console.log("2. Adding delivered_at column to input_distributions...");
    await client.query("ALTER TABLE input_distributions ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE DEFAULT now();");

    console.log("3. Adding program_enrollment_status column to clusters and farmer_profiles...");
    await client.query("ALTER TABLE clusters ADD COLUMN IF NOT EXISTS program_enrollment_status VARCHAR(50) DEFAULT 'unassigned';");
    await client.query("ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS program_enrollment_status VARCHAR(50) DEFAULT 'unassigned';");
    await client.query("ALTER TABLE farmer_programmes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_verification';");

    console.log("4. Ensuring field_verifications has geospatial and media columns...");
    await client.query("ALTER TABLE field_verifications ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);");
    await client.query("ALTER TABLE field_verifications ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);");
    await client.query("ALTER TABLE field_verifications ADD COLUMN IF NOT EXISTS geospatial_metadata JSONB DEFAULT '{}'::jsonb;");
    await client.query("ALTER TABLE field_verifications ADD COLUMN IF NOT EXISTS image_urls TEXT[];");
    await client.query("ALTER TABLE field_verifications ADD COLUMN IF NOT EXISTS video_url TEXT;");

    await client.query("COMMIT");
    console.log("Migration executed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
