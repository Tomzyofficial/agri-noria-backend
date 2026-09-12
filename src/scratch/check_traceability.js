import pool from '../lib/connect.js';

async function main() {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'traceability_logs'
    `);
    console.log('traceability_logs columns:', cols.rows);

    const rows = await pool.query('SELECT * FROM traceability_logs');
    console.log('traceability_logs rows:', rows.rows);

    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%trace%'
    `);
    console.log('trace tables:', allTables.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
