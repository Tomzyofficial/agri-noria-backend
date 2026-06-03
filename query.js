import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

async function run() {
    try {
        const res = await pool.query("SELECT id, email, workspace, role FROM vendors");
        console.log("All vendors:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
