import pool from "../../lib/connect.js";

// Create a new program
async function createProgram(data) {
   const {
      name, region, commodity, target_farmers, target_hectares,
      input_financing, harvest_financing, insurance_included,
      gps_verification_required, mid_season_inspection_required,
      harvest_audit_required, created_by, start_date, end_date
   } = data;

   const { rows } = await pool.query(
      `INSERT INTO programs (
         name, region, commodity, target_farmers, target_hectares,
         input_financing, harvest_financing, insurance_included,
         gps_verification_required, mid_season_inspection_required,
         harvest_audit_required, start_date, end_date, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14) RETURNING *`,
      [
         name, region, commodity,
         parseInt(target_farmers) || 0,
         parseFloat(target_hectares) || 0,
         input_financing || false,
         harvest_financing || false,
         insurance_included || false,
         gps_verification_required !== false,
         mid_season_inspection_required !== false,
         harvest_audit_required !== false,
         start_date || null,
         end_date || null,
         created_by
      ]
   );
   return rows[0];
}

// Get all programs
async function getAllPrograms() {
   const { rows } = await pool.query(
      `SELECT p.*, v.fname || ' ' || v.lname as creator_name
       FROM programs p 
       LEFT JOIN vendors v ON p.created_by = v.id
       ORDER BY p.created_at DESC`
   );
   return rows;
}

// Get program by ID
async function getProgramById(id) {
   const { rows } = await pool.query("SELECT * FROM programs WHERE id = $1", [id]);
   return rows[0] || null;
}

// Get programs created by a specific vendor
async function getProgramsByCreator(vendorId) {
   const { rows } = await pool.query(
      "SELECT * FROM programs WHERE created_by = $1 ORDER BY created_at DESC",
      [vendorId]
   );
   return rows;
}

async function updateProgram(id, data) {
   const fields = [];
   const values = [];
   let idx = 1;

   for (const [key, value] of Object.entries(data)) {
      if (['name', 'region', 'commodity', 'target_farmers', 'target_hectares', 'start_date', 'end_date', 'status'].includes(key)) {
         fields.push(`${key} = $${idx}`);
         values.push(value);
         idx++;
      }
   }

   if (fields.length === 0) return null;

   values.push(id);
   const { rows } = await pool.query(
      `UPDATE programs SET ${fields.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
      values
   );
   return rows[0];
}

export { createProgram, getAllPrograms, getProgramById, getProgramsByCreator, updateProgram };
