import pool from '../src/lib/connect.js';

async function run() {
    try {
        // First ensure total_capacity_mt column exists on vendors table if missing
        await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS total_capacity_mt NUMERIC DEFAULT 0');
        console.log('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS total_capacity_mt NUMERIC DEFAULT 0 succeeded');

        const query = `SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, role 
                       FROM vendors 
                       WHERE LOWER(role) LIKE '%storage%' OR LOWER(role) LIKE '%warehouse%'`;
        const { rows } = await pool.query(query);
        console.log('STORAGE PROVIDERS QUERY RESULT:');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
