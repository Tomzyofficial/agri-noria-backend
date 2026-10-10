import pool from "../src/lib/connect.js";

async function run() {
  try {
    const r1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'input_distributions'");
    console.log("input_distributions columns:", r1.rows.map(c => c.column_name));

    const r2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'input_requests'");
    console.log("input_requests columns:", r2.rows.map(c => c.column_name));

    const r3 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'farmer_profiles'");
    console.log("farmer_profiles columns:", r3.rows.map(c => c.column_name));

    const r4 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors'");
    console.log("vendors columns:", r4.rows.map(c => c.column_name));

    const r5 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clusters'");
    console.log("clusters columns:", r5.rows.map(c => c.column_name));

    const r6 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'repayments'");
    console.log("repayments columns:", r6.rows.map(c => c.column_name));
    const r7 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'field_verifications'");
    console.log("field_verifications columns:", r7.rows.map(c => c.column_name));
  } catch (err) {
    console.error("Diagnostic error:", err);
  } finally {
    await pool.end();
  }
}

run();
