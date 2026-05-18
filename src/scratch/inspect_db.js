import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://postgres:success1050@localhost:5432/AgriConnect' });

async function inspect() {
   try {
      const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'buyer_orders'");
      console.log(JSON.stringify(res.rows, null, 2));
   } catch (err) {
      console.error(err);
   } finally {
      await pool.end();
   }
}

inspect();
