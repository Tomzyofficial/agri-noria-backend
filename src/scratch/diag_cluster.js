import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const clusters = await pool.query("SELECT * FROM clusters ORDER BY created_at DESC LIMIT 1");
console.log('Cluster:', clusters.rows[0]);

if (clusters.rows.length > 0 && clusters.rows[0].supervisor_id) {
    const vendor = await pool.query("SELECT id, fname, lname, onboarding_status, account_type FROM vendors WHERE id = $1", [clusters.rows[0].supervisor_id]);
    console.log('Supervisor vendor:', vendor.rows[0]);
} else {
    console.log('No cluster or supervisor found');
}

await pool.end();
