import pool from '../../src/lib/connect.js';

async function checkUser() {
  const email = 'emmabrown@gmail.com';
  try {
    const res = await pool.query('SELECT id, email, role, onboarding_level, onboarding_status FROM vendors WHERE email = $1', [email]);
    console.log('--- Vendors Table ---');
    console.log(res.rows[0]);
    
    if (res.rows[0]) {
      const farmerRes = await pool.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [res.rows[0].id]);
      console.log('--- Farmer Profiles Table ---');
      console.log(farmerRes.rows[0]);
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkUser();
