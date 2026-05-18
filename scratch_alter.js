import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
   connectionString: process.env.DATABASE_URL
});

async function run() {
   try {
      await pool.query("ALTER TABLE programs ADD COLUMN IF NOT EXISTS start_date DATE");
      await pool.query("ALTER TABLE programs ADD COLUMN IF NOT EXISTS end_date DATE");
      
      await pool.query("ALTER TABLE planting_activities ADD COLUMN IF NOT EXISTS planting_date DATE");
      await pool.query("ALTER TABLE planting_activities ADD COLUMN IF NOT EXISTS expected_harvest_date DATE");
      
      console.log("Schema altered successfully");
   } catch (e) {
      console.error(e);
   } finally {
      pool.end();
   }
}

run();
