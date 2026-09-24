import pool from "../../lib/connect.js";

// Get user by email or phone
async function getUserByEmail(emailOrPhone) {
  const identifier = emailOrPhone ? String(emailOrPhone).trim() : "";
  const { rows } = await pool.query(
    "SELECT id, email, fname, lname, phone, pword, workspace, role, is_active, is_suspended, onboarding_status, is_verified, onboarding_level FROM vendors WHERE LOWER(email) = LOWER($1) OR (phone IS NOT NULL AND phone = $1) LIMIT 1",
    [identifier],
  );
  return rows[0] || null;
}

// Create user
async function createUser(
  fname,
  lname,
  email,
  phone,
  pword,
  terms_of_service,
  workspace,
  role,
  approval_status = "approved",
) {
  const { rows } = await pool.query(
    `INSERT INTO vendors (fname, lname, email, phone, pword, terms_of_service, workspace, role, approval_status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      fname,
      lname,
      email,
      phone,
      pword,
      terms_of_service,
      workspace,
      role,
      approval_status,
    ],
  );
  return rows[0] || [];
}

async function createFarmerProfile(vendorId, ain) {
  const { rows } = await pool.query(
    `INSERT INTO farmer_profiles (vendor_id, agricultural_identity_number, certification_status)
     VALUES ($1, $2, 'draft') RETURNING *`,
    [vendorId, ain],
  );
  return rows[0] || [];
}

// Check if vendor has active subscription and is verified
async function checkVendorListingEligibility(id) {
  try {
    const { rows } = await pool.query(
      "SELECT vs.status, v.is_verified FROM vendor_subscriptions AS vs JOIN vendors AS v ON v.id = vs.vendor_id WHERE vs.status = 'active' AND vs.vendor_id = $1",
      [id],
    );
    const data = rows[0];
    return { status: data.status, is_verified: data.is_verified };
  } catch {
    return { status: false, is_verified: false };
  }
}

async function createFieldOperationsDocuments(
  vendorId,
  appLetter,
  idCard,
  optDoc,
) {
  const { rows } = await pool.query(
    `INSERT INTO field_operations_documents (vendor_id, appointment_letter_url, id_card_url, optional_document_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [vendorId, appLetter, idCard, optDoc],
  );
  return rows[0] || null;
}

export {
  getUserByEmail,
  createUser,
  checkVendorListingEligibility,
  createFarmerProfile,
  createFieldOperationsDocuments,
};
