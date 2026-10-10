import pool from '../src/lib/connect.js';

async function check() {
   try {
      const cols = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'input_distributions'`);
      console.log('INPUT_DISTRIBUTIONS COLUMNS:', cols.rows);

      const irCols = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'input_requests'`);
      console.log('INPUT_REQUESTS COLUMNS:', irCols.rows.map(c => c.column_name));

      const clusters = await pool.query(`SELECT id, name, status FROM clusters LIMIT 5`);
      console.log('CLUSTERS:', clusters.rows);

      const reqs = await pool.query(`SELECT id, cluster_id, farmer_id, is_cluster_request, status, funds_status, items_status FROM input_requests WHERE cluster_id IS NOT NULL ORDER BY created_at DESC LIMIT 5`);
      console.log('CLUSTER INPUT REQS:', reqs.rows);
   } catch(e) {
      console.error(e);
   } finally {
      process.exit(0);
   }
}

check();
