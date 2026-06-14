import pool from "../../lib/connect";

export async function getJobsPulicPlace() {
  const query = "SELECT * FROM jobs ORDER BY DESC";
  const result = await pool.query(query);
  return result.rows;
}
