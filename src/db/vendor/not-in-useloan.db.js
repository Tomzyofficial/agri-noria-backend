import pool from "../../lib/connect.js";

async function createNewApplication({ data }) {
   try {
      const values = [
         data.vendor_id,
         data.org_name,
         data.years_in_operation,
         data.amount,
         data.repay_amount,
         data.repay_period,
         data.monthly_revenue,
         data.farm_size || null,
         data.primary_crop || null,
         data.inv_type || null,
         data.total_capacity || null,
         data.current_utilization || null,
         data.storage_type || null,
         data.farmers_served || null,
         data.supporting_doc,
         data.bank_statement,
      ];
      const query = `INSERT INTO loans(vendor_id, org_name, years_in_operation, amount, repay_amount, repay_period, monthly_revenue, farm_size, primary_crop, inv_type, total_capacity, current_utilization, storage_type, farmers_served, supporting_doc, bank_statement) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`;
      const result = await pool.query(query, values);

      if (!result.rows[0]) {
         return { success: false, error: "Failed to create loan application" };
      }
      return { success: true, data: result.rows[0] };
   } catch (error) {
      return { success: false, error: error.message || "Error occurred while creating loan application" };
   }
}

async function getAllApplications(vendor_id) {
   try {
      const result = await pool.query("SELECT * FROM loans WHERE vendor_id = $1 ORDER BY created_at DESC", [vendor_id]);
      return result.rows;
   } catch (error) {
      console.error("Error fetching loan applications:", error.message);
      return { error: error.message };
   }
}

/* async function retrieveLoanIdPerVendor(vendor_id) {
   try {
      const result = await pool.query("SELECT id FROM loans WHERE vendor_id = $1 AND status = 'active'", [vendor_id]);
      return result.rows[0]?.id;
   } catch (error) {
      console.error("Error fetching loan applications:", error.message);
      return { error: error.message };
   }
} */

/* async function getLoanById(loan_id) {
   try {
      const result = await pool.query("SELECT * FROM loans WHERE id = $1", [loan_id]);
      return result.rows[0];
   } catch (error) {
      console.error("Error fetching loan by ID:", error.message);
      return { error: error.message };
   }
} */

export { createNewApplication, getAllApplications };
