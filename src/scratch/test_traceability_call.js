import pool from '../lib/connect.js';
import * as adminDb from '../db/admin/admin.db.js';

async function test() {
  try {
    const { rows: vendors } = await pool.query("SELECT id, role, email FROM vendors WHERE role = 'institution' OR workspace = 'ecosystem' LIMIT 5");
    console.log('Vendors:', vendors);

    for (const v of vendors) {
      const res = await adminDb.getInstitutionTraceability(v.id, v.role);
      console.log(`Traceability for ${v.email} (${v.role}):`, res);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

test();
