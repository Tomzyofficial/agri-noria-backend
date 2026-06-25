import pool from './src/lib/connect.js';

async function check() {
  try {
    const res = await pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('sales', 'repayments', 'field_verifications', 'input_requests')");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
