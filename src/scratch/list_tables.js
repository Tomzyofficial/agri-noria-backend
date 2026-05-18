import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkTables() {
   try {
      const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      console.log("Tables:", res.rows.map(r => r.table_name));
      
      // Also check structure of programs if it exists
      const hasPrograms = res.rows.some(r => r.table_name === 'programs');
      if (hasPrograms) {
         const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'programs'");
         console.log("Programs columns:", cols.rows);
      } else {
         console.log("Programs table does NOT exist.");
      }
   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

checkTables();
