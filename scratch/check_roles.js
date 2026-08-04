import pool from '../src/lib/connect.js';

async function run() {
    try {
        const { rows } = await pool.query('SELECT id, fname, lname, company_name, email, role, workspace FROM vendors ORDER BY created_at DESC');
        console.log('ALL VENDORS IN DB:');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
