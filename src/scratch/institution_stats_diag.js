import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getInstitutionStats() {
   try {
      // 1. Program & Farmer Stats
      const programs = await pool.query("SELECT COUNT(*) as count FROM programs");
      const farmers = await pool.query("SELECT COUNT(*) as count FROM farmer_profiles");
      const hectares = await pool.query("SELECT SUM(target_hectares) as total FROM programs");
      
      // 2. Financial Stats (from input_requests)
      const inputRequests = await pool.query(`
         SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
            SUM(total_value) FILTER (WHERE status = 'pending') as pending_value,
            COUNT(*) FILTER (WHERE status = 'approved' OR status = 'distributed') as approved_count,
            SUM(total_value) FILTER (WHERE status = 'approved' OR status = 'distributed') as approved_value,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
            SUM(total_value) FILTER (WHERE status = 'rejected') as rejected_value
         FROM input_requests
      `);

      // 3. Wallet Stats
      const wallets = await pool.query("SELECT SUM(balance) as total_balance, SUM(locked_balance) as total_locked FROM wallets");
      
      console.log("--- Ecosystem Stats ---");
      console.log("Active Programs:", programs.rows[0].count);
      console.log("Total Farmers:", farmers.rows[0].count);
      console.log("Total Hectares:", hectares.rows[0].total || 0);
      console.log("--- Financial Approvals ---");
      console.log("Pending:", inputRequests.rows[0].pending_count, "(₦", inputRequests.rows[0].pending_value || 0, ")");
      console.log("Approved/Distributed:", inputRequests.rows[0].approved_count, "(₦", inputRequests.rows[0].approved_value || 0, ")");
      console.log("Rejected:", inputRequests.rows[0].rejected_count, "(₦", inputRequests.rows[0].rejected_value || 0, ")");
      console.log("--- Wallets ---");
      console.log("Total Balance:", wallets.rows[0].total_balance || 0);
      console.log("Total Locked (Financing):", wallets.rows[0].total_locked || 0);

   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

getInstitutionStats();
