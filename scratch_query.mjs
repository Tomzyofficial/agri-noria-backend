import pool from './src/lib/connect.js';

async function updateVendorBasicInfo(id, fname, lname, phone) {
   try {
      const { rows } = await pool.query(
         `UPDATE vendors SET fname = COALESCE($1, fname), lname = COALESCE($2, lname), phone = COALESCE($3, phone) 
WHERE id = $4 RETURNING id, fname, lname, phone, email`,
         [fname, lname, phone, id]
      );
      return rows[0] || null;
   } catch (error) {
      console.error("Database error in updateVendorBasicInfo:", error);
      return null;
   }
}

async function test() {
   try {
      const vendorId = '8ec06885-c96b-4d01-8002-a4a8af4d5c32'; // emma1200@gmail.com
      const res = await updateVendorBasicInfo(vendorId, 'Emma', 'Success', '08139738894');
      console.log('Result:', res);
   } catch (e) {
      console.error('Error:', e);
   } finally {
      process.exit(0);
   }
}

test();
