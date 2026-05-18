import pool from "../lib/connect.js";

async function migrate() {
   try {
      console.log("Starting farm supervision migration...");

      await pool.query(`
         CREATE TABLE IF NOT EXISTS farm_supervisions (
            id SERIAL PRIMARY KEY,
            farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
            officer_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
            program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
            
            clearing_status VARCHAR(20) DEFAULT 'pending',
            clearing_notes TEXT,
            clearing_updated_at TIMESTAMP,

            irrigation_status VARCHAR(20) DEFAULT 'pending',
            irrigation_notes TEXT,
            irrigation_updated_at TIMESTAMP,

            ridging_status VARCHAR(20) DEFAULT 'pending',
            ridging_notes TEXT,
            ridging_updated_at TIMESTAMP,

            weeding_status VARCHAR(20) DEFAULT 'pending',
            weeding_notes TEXT,
            weeding_updated_at TIMESTAMP,

            harvesting_status VARCHAR(20) DEFAULT 'pending',
            harvesting_notes TEXT,
            harvesting_updated_at TIMESTAMP,

            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            UNIQUE(farmer_id, program_id)
         );
      `);

      console.log("Farm supervision table created successfully.");
   } catch (error) {
      console.error("Migration failed:", error);
   } finally {
      process.exit();
   }
}

migrate();
