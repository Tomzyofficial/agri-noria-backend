import pool from "../lib/connect.js";

async function runMigration() {
   try {
      console.log("Starting database migration...");

      // 1. Add onboarding_status column to vendors table if it doesn't exist
      console.log("Adding onboarding_status column to vendors table...");
      await pool.query(`
         ALTER TABLE vendors
         ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'pending';
      `);
      console.log("✓ Column added (or already existed)");

      // 2. Backfill status for Farmers
      console.log("Backfilling onboarding_status for Farmers...");
      const farmerUpdate = await pool.query(`
         UPDATE vendors 
         SET onboarding_status = 'completed' 
         WHERE id IN (SELECT vendor_id FROM farmer_profiles WHERE onboarding_status = 'completed');
      `);
      console.log(`✓ Updated ${farmerUpdate.rowCount} farmers`);

      // 3. Backfill status for Ecosystem Users/Vendors (who have submitted documents)
      console.log("Backfilling onboarding_status for Ecosystem users with documents...");
      const ecosystemUpdate = await pool.query(`
         UPDATE vendors 
         SET onboarding_status = 'completed' 
         WHERE id IN (SELECT vendor_id FROM vendor_documents)
         AND onboarding_status = 'pending';
      `);
      console.log(`✓ Updated ${ecosystemUpdate.rowCount} ecosystem users`);
      console.log("Migration completed successfully!");
      process.exit(0);
   } catch (error) {
      console.error("Migration failed:", error);
      process.exit(1);
   }
}

runMigration();
