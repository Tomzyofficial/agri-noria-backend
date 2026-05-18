import pool from "../src/lib/connect.js";

async function check() {
  try {
    const { rows: dists } = await pool.query("SELECT * FROM vendors WHERE email = 'emmanuel589@gmail.com'");
    console.log("Distributor:", dists);
    if (dists.length > 0) {
      const { rows: reqs } = await pool.query("SELECT id, items_status, distributor_id, farmer_id FROM input_requests WHERE distributor_id = $1", [dists[0].id]);
      console.log("Requests assigned:", reqs);
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
