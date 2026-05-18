import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
   try {
      const r1 = await pool.query('SELECT COUNT(*) FROM vendors');
      console.log('Vendors:', r1.rows[0].count);
      const r2 = await pool.query('SELECT COUNT(*) FROM buyers');
      console.log('Buyers:', r2.rows[0].count);
      const r3 = await pool.query('SELECT COUNT(*) FROM aggregator_buyers');
      console.log('AggregatorBuyers:', r3.rows[0].count);
      const r4 = await pool.query('SELECT account_type, COUNT(*) as count FROM vendors GROUP BY account_type');
      console.log('Role counts:', JSON.stringify(r4.rows));
      const r5 = await pool.query(`SELECT ab.id, ab.buyer_name, ab.aggregator_id, v.fname, v.lname, v.email, v.phone FROM aggregator_buyers ab LEFT JOIN vendors v ON ab.aggregator_id = v.id LIMIT 3`);
      console.log('Sample agg buyers:', JSON.stringify(r5.rows));
      const r6 = await pool.query(`SELECT TO_CHAR(created_at, 'Mon') as month, EXTRACT(MONTH FROM created_at) as month_num, COUNT(*) as count FROM vendors WHERE created_at >= NOW() - INTERVAL '12 months' GROUP BY month, month_num ORDER BY month_num`);
      console.log('Monthly vendor signups:', JSON.stringify(r6.rows));
      const r7 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'buyer_agreements' ORDER BY ordinal_position`);
      console.log('buyer_agreements cols:', r7.rows.map(r => r.column_name).join(', '));
      const r8 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'escrow_payments' ORDER BY ordinal_position`);
      console.log('escrow_payments cols:', r8.rows.map(r => r.column_name).join(', '));
   } catch(e) {
      console.error('Error:', e.message);
   } finally {
      await pool.end();
   }
}
run();
