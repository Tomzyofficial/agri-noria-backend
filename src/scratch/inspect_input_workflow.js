import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function listTables() {
   try {
      const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      console.log("Tables:", res.rows.map(r => r.table_name));
      
      const columns = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('input_requests', 'vendors', 'farmer_profiles', 'training_enrolments', 'trainings')");
      console.log("Columns:", columns.rows);
   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

listTables();
