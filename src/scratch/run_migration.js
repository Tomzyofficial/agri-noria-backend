import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
   try {
      const sql = fs.readFileSync('src/scratch/migrate_input_workflow.sql', 'utf8');
      await pool.query(sql);
      console.log("Migration successful");
   } catch (err) {
      console.error("Migration failed:", err);
   } finally {
      await pool.end();
   }
}

runMigration();
