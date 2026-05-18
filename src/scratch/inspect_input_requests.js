import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function inspectInputRequests() {
   try {
      const columns = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'input_requests'");
      console.log("Input Requests Columns:", columns.rows);
      
      const distributors = await pool.query("SELECT id, fname, lname, email, account_type FROM vendors WHERE account_type ILIKE '%distributor%'");
      console.log("Distributors:", distributors.rows);
   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

inspectInputRequests();
