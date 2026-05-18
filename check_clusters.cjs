const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

async function run() {
    // Check columns
    const cols = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clusters'");
    console.log('Columns:', cols.rows.map(c => c.column_name).join(', '));

    // Get real data
    const rows = await p.query("SELECT * FROM clusters ORDER BY created_at DESC LIMIT 5");
    console.log('\nClusters:');
    rows.rows.forEach(r => console.log(r));

    await p.end();
}
run().catch(console.error);
