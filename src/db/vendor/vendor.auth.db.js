import pool from "../../lib/connect.js";

// Get user by email
async function getUserByEmail(email) {
  const { rows } = await pool.query(
    "SELECT id, email, fname, lname, phone, account_type, pword, workspace, role, is_suspended, onboarding_status FROM vendors WHERE email = $1 LIMIT 1",
    [email],
  );
  return rows[0];
}

// Create user
async function createUser(
  fname,
  lname,
  email,
  phone,
  //   account_type,
  pword,
  terms_of_service,
  workspace,
  role,
) {
  const { rows } = await pool.query(
    `INSERT INTO vendors (fname, lname, email, phone, pword, terms_of_service, workspace, role) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [fname, lname, email, phone, pword, terms_of_service, workspace, role],
  );
  return rows[0] || [];
}

// Check if vendor has active subscription
async function checkVendorListingEligibility(id) {
  try {
    const { rows } = await pool.query(
      "SELECT vs.status, v.is_verified FROM vendor_subscriptions AS vs JOIN vendors AS v ON v.id = vs.vendor_id WHERE vs.status = 'active' AND vs.vendor_id = $1",
      [id],
    );
    const data = rows[0];
    return { status: data.status, is_verified: data.is_verified };
  } catch {
    return { status: false };
  }
}

export { getUserByEmail, createUser, checkVendorListingEligibility };
