import pool from "./src/lib/connect.js";

async function alterTable() {
  try {
    await pool.query(`
      ALTER TABLE public.buyers 
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS company_name TEXT,
      ADD COLUMN IF NOT EXISTS registration_number TEXT,
      ADD COLUMN IF NOT EXISTS tax_id TEXT,
      ADD COLUMN IF NOT EXISTS headquarters TEXT;
    `);
    console.log("Altered public.buyers table successfully.");
  } catch (err) {
    console.error("Error altering table", err);
  } finally {
    process.exit(0);
  }
}

alterTable();
