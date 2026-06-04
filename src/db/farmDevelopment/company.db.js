import pool from "../../lib/connect.js";

export async function getCompany(companyId) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM companies WHERE id = $1',
      [companyId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getCompany:", error);
    return null;
  }
}

export async function createCompany(userId, name, description, website, phone, email, address, city, state, zipCode, country) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO companies (user_id, name, description, website, phone, email, address, city, state, zip_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, name, description || '', website || '', phone || '', email || '', address || '', city || '', state || '', zipCode || '', country || '']
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in createCompany:", error);
    return null;
  }
}

export async function updateCompany(companyId, name, description, website, phone, email, address, city, state, zipCode, country) {
  try {
    const { rows } = await pool.query(
      `UPDATE companies 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           website = COALESCE($3, website),
           phone = COALESCE($4, phone),
           email = COALESCE($5, email),
           address = COALESCE($6, address),
           city = COALESCE($7, city),
           state = COALESCE($8, state),
           zip_code = COALESCE($9, zip_code),
           country = COALESCE($10, country),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [name, description, website, phone, email, address, city, state, zipCode, country, companyId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updateCompany:", error);
    return null;
  }
}
