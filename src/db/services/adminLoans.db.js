import pool from "../../lib/connect.js";
export async function getAdminAllApplications() {
   try {
      const result = await pool.query("SELECT * FROM loans ORDER BY created_at DESC");
      return result.rows;
   } catch (error) {
      console.error("Error fetching loan applications:", error.message);
      return { error: error.message };
   }
}
