import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const requester_id = '1e0678b0-5524-4ce6-a24c-429cc73e36fb'; // this was the supervisor id
const vendor = await pool.query("SELECT onboarding_status, account_type FROM vendors WHERE id = $1", [requester_id]);

console.log('Vendor:', vendor.rows[0]);

await pool.end();
