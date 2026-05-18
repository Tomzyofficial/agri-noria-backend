import pool from "../lib/connect.js";
export async function countryUtils(data) {
   const { vendor_id, user_id, country_name, country_code, state_code, state_name, currency } = data;
   try {
      const { rows } = await pool.query(
         `INSERT INTO country_utils (vendor_id, user_id, country_name, country_code, state_code, state_name, currency) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
         [vendor_id, user_id, country_name, country_code, state_code, state_name, currency],
      );
      return rows;
   } catch (error) {
      console.log("error occurred passing country data", error);
   }
}
