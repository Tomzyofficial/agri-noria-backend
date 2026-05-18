import pool from "../lib/connect.js";

async function migrate() {
   try {
      console.log("Starting migration: Add is_suspended to vendors table...");
      await pool.query(`
         ALTER TABLE vendors 
         ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
      `);
      console.log("Migration successful: is_suspended column added.");
      process.exit(0);
   } catch (error) {
      console.error("Migration failed:", error);
      process.exit(1);
   }
}

migrate();
