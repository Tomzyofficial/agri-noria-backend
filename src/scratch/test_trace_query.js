import pool from '../lib/connect.js';

async function testTraceQuery() {
  try {
    let query = `
      SELECT 
        COALESCE(tl.id::text, hb.batch_id::text, gen_random_uuid()::text) as id,
        COALESCE(tl.batch_number, hb.batch_number, 'HB-BATCH') as batch_number,
        COALESCE(tl.origin, hb.location, 'Farm Gate') as origin,
        COALESCE(tl.destination, lt.destination, 'Designated Warehouse') as destination,
        COALESCE(tl.status, lt.status, hb.status, 'in_transit') as status,
        COALESCE(tl.timestamp, lt.created_at, hb.created_at, now()) as timestamp,
        hb.crop,
        hb.quantity_mt
      FROM harvest_batches hb
      LEFT JOIN logistics_tickets lt ON hb.batch_id = lt.batch_id
      FULL OUTER JOIN traceability_logs tl ON hb.batch_number = tl.batch_number
      ORDER BY timestamp DESC
    `;
    const { rows } = await pool.query(query);
    console.log('Query success! Rows count:', rows.length);
    console.log('Sample row:', rows[0]);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    process.exit(0);
  }
}

testTraceQuery();
