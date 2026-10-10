import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";
import pool from "../../lib/connect.js";

export async function uploadVendorProfileImage(id, profileImageUrl, publicId) {
  const { rows } = await pool.query(
    `UPDATE vendors SET profile_image_url = $1, public_id = $2 WHERE id = $3 RETURNING  profile_image_url`,
    [profileImageUrl, publicId, id],
  );
  return rows[0].profile_image_url ?? null;
}

// Retrieve updated profile image
export async function getUpdatedProfileImage(id) {
  const { rows } = await pool.query(
    `SELECT profile_image_url, public_id FROM vendors WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

// Upsert vendor documents (by vendor_id) including business fields
export async function upsertVendorDocuments(
  vendor_id,
  business_name,
  hot_line_phone_number,
  address,
  business_desc,
  id_front_url,
  id_back_url,
  license_url,
) {
  try {
    const existing = await pool.query(
      `SELECT id FROM vendor_documents WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );
    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE vendor_documents SET business_name = COALESCE($2, business_name),
               hot_line_phone_number = COALESCE($3, hot_line_phone_number), address = COALESCE($4, address), business_desc = COALESCE($5, business_desc),
               id_front_url = COALESCE($6, id_front_url), id_back_url = COALESCE($7, id_back_url), license_url = COALESCE($8, license_url) WHERE vendor_id = $1 RETURNING *`,
        [
          vendor_id,
          business_name ?? null,
          hot_line_phone_number ?? null,
          address ?? null,
          business_desc ?? null,
          id_front_url ?? null,
          id_back_url ?? null,
          license_url ?? null,
        ],
      );
      if (business_name) {
        await pool.query(
          "UPDATE vendors SET company_name = $2 WHERE id = $1",
          [vendor_id, business_name],
        );
      }
      return updated.rows[0];
    } else {
      const inserted = await pool.query(
        `INSERT INTO vendor_documents (vendor_id, business_name, hot_line_phone_number, address, business_desc, id_front_url, id_back_url, license_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          vendor_id,
          business_name ?? null,
          hot_line_phone_number ?? null,
          address ?? null,
          business_desc ?? null,
          id_front_url ?? null,
          id_back_url ?? null,
          license_url ?? null,
        ],
      );

      // Sync onboarding_status and company_name to vendors table
      await pool.query(
        "UPDATE vendors SET onboarding_status = 'completed', company_name = COALESCE($2, company_name) WHERE id = $1",
        [vendor_id, business_name || null],
      );

      return inserted.rows[0];
    }
  } catch (error) {
    console.error("Database error in upsertVendorDocuments:", error);
    return null;
  }
}

// Upsert vendor bank account (by vendor_id)
export async function upsertVendorBankAccount(
  vendor_id,
  bank_name,
  account_name,
  account_number,
) {
  try {
    const existing = await pool.query(
      `SELECT id FROM vendor_bank_accounts WHERE vendor_id = $1 LIMIT 1`,
      [vendor_id],
    );
    if (existing.rows.length > 0) {
      // Update existing record - only update fields that are provided (not null)
      const updated = await pool.query(
        `UPDATE vendor_bank_accounts SET bank_name = COALESCE($1, bank_name), account_name = COALESCE($2, account_name), account_number = COALESCE($3, account_number) WHERE vendor_id = $4 RETURNING *`,
        [
          bank_name ?? null,
          account_name ?? null,
          account_number ?? null,
          vendor_id,
        ],
      );
      return updated.rows[0];
    } else {
      if (!bank_name || !account_name || !account_number) {
        console.error(
          "Cannot insert bank account: all fields (bank_name, account_name, account_number) are required",
        );
        return null;
      }
      const inserted = await pool.query(
        `INSERT INTO vendor_bank_accounts (vendor_id, bank_name, account_name, account_number) VALUES ($1, $2, $3, $4) RETURNING *`,
        [vendor_id, bank_name, account_name, account_number],
      );
      return inserted.rows[0];
    }
  } catch (error) {
    console.error("Database error in upsertVendorBankAccount:", error);
    return null;
  }
}

// Get the vendor's documents row per vendor_id with fallbacks to registration and ecosystem data
export async function getVendorProfileInfo(id) {
  try {
    const { rows } = await pool.query(
      `SELECT 
          v.id,
          v.fname,
          v.lname,
          v.email,
          v.phone,
          v.company_name,
          v.role,
          v.workspace,
          v.is_verified,
          v.onboarding_status,
          v.profile_image_url,
          cu.state_name,
          cu.country_name,
          cu.country_code,
          cu.currency,
          vd.id as document_id,
          vd.business_name as doc_business_name,
          vd.hot_line_phone_number as doc_phone,
          vd.address as doc_address,
          vd.business_desc as doc_business_desc,
          vd.id_front_status,
          vd.id_back_status,
          vd.license_status,
          vd.id_front_url,
          vd.id_back_url,
          vd.license_url,
          (SELECT f.farm_name FROM farms f WHERE f.vendor_id = v.id ORDER BY f.id DESC LIMIT 1) as farm_name,
          (SELECT sf.listing_name FROM storage_facility sf WHERE sf.account_id = v.id ORDER BY sf.id DESC LIMIT 1) as facility_name,
          (SELECT veh.title FROM vehicles veh WHERE veh.vendor_id = v.id ORDER BY veh.id DESC LIMIT 1) as vehicle_title
       FROM vendors v
       LEFT JOIN country_utils cu ON cu.vendor_id = v.id
       LEFT JOIN vendor_documents vd ON vd.vendor_id = v.id
       WHERE v.id = $1
       ORDER BY vd.id ASC NULLS LAST
       LIMIT 1`,
      [id],
    );

    const v = rows?.[0];
    if (!v) {
      return {
        success: false,
        data: {
          rows: null,
          id_front_status: null,
          id_back_status: null,
          license_status: null,
          business_name: null,
          hot_line_phone_number: null,
          address: null,
          business_desc: null,
        },
      };
    }

    // Derive business_name from documents, company_name, specialized tables, or user full name
    const fullName = [v.fname, v.lname].filter(Boolean).join(" ").trim();
    const business_name =
      v.doc_business_name ||
      v.company_name ||
      v.farm_name ||
      v.facility_name ||
      v.vehicle_title ||
      (fullName ? `${fullName} Enterprise` : "Agri-Noria Partner");

    // Derive phone number
    const hot_line_phone_number = v.doc_phone || v.phone || "";

    // Derive address from documents or state/country
    const derivedLocation = [v.state_name, v.country_name].filter(Boolean).join(", ");
    const address = v.doc_address || derivedLocation || "Nigeria";

    // Derive professional description based on role
    const roleName = v.role ? v.role.charAt(0).toUpperCase() + v.role.slice(1) : "Partner";
    const defaultDesc = `${roleName} operating on the Agri-Noria platform. Providing agricultural and supply chain services.`;
    const business_desc = v.doc_business_desc || defaultDesc;

    // Derive document verification status based on vendor verification
    const isVerified = v.is_verified === true || v.onboarding_status === "verified" || v.onboarding_status === "completed";
    const defaultDocStatus = isVerified ? "approved" : "pending";

    const id_front_status = v.id_front_status || defaultDocStatus;
    const id_back_status = v.id_back_status || defaultDocStatus;
    const license_status = v.license_status || defaultDocStatus;

    return {
      success: true,
      data: {
        rows: {
          id_front_status,
          id_back_status,
          license_status,
          business_name,
          hot_line_phone_number,
          address,
          business_desc,
        },
        id_front_status,
        id_back_status,
        license_status,
        business_name,
        hot_line_phone_number,
        address,
        business_desc,
        fname: v.fname,
        lname: v.lname,
        email: v.email,
        phone: v.phone,
        company_name: v.company_name,
        role: v.role,
        workspace: v.workspace,
        is_verified: isVerified,
      },
    };
  } catch (error) {
    console.error("Database error in getVendorProfileInfo:", error);
    return {
      success: false,
      data: {
        rows: null,
        id_front_status: null,
        id_back_status: null,
        license_status: null,
        business_name: null,
        hot_line_phone_number: null,
        address: null,
        business_desc: null,
      },
    };
  }
}

// Check for verified vendor
export async function checkVerifiedVendor(id) {
  try {
    const { rows: verified } = await pool.query(
      "SELECT is_verified FROM vendors WHERE id = $1",
      [id],
    );

    const isVerified = verified[0]?.is_verified === true;
    //  console.log("isverified", isVerified);

    return isVerified;
  } catch (error) {
    console.error(
      "Database error in checkVerifiedVendor in profile db.js:",
      error,
    );
    return false;
  }
}

// Get ratings for a product per vendor profile
export async function getRatings(id) {
  try {
    const { rows } = await pool.query(
      `
         SELECT r.rating, COUNT(*) AS count FROM reviews r JOIN listings ls ON r.listing_id = ls.id
         WHERE ls.account_id = $1 GROUP BY r.rating ORDER BY r.rating DESC`,
      [id],
    );

    const ratings = {
      total: 0, // The total number of star review
      average: 0, // The overall average rating
      breakdown: {
        5: 0, // Number of 5-star reviews
        4: 0, // Number of 4-star reviews
        3: 0, // Number of 3-star reviews
        2: 0, // Number of 2-star reviews
        1: 0, // Number of 1-star reviews
      },
    };

    // Calculate total and populate breakdown
    rows.forEach((row) => {
      const rating = parseInt(row.rating, 10); // for instance buyer A give a 2 star rating, rating = 2
      const count = parseInt(row.count, 10); // How many times did 2 star appear. for instance 1x. count = 1
      ratings.breakdown[rating] = count; // for instance 2 star is 1 in no. 2 star now holds count of 1 etc.
      ratings.total += count; // Total counts of each star rating
      ratings.average += rating * count; // For instance 2 star appeared 1x in the table. 2 x 1 = 2
    });

    // Calculate average
    if (ratings.total > 0) {
      ratings.average = (ratings.average / ratings.total).toFixed(1); // From the above eg, 2 / 1 = 2
    }
    return ratings;
  } catch {
    throw new Error("Failed to fetch ratings");
  }
}
export async function finalizeOnboarding(vendor_id) {
  try {
    await pool.query(
      "UPDATE vendors SET onboarding_status = 'completed', is_verified = true WHERE id = $1",
      [vendor_id],
    );
    return true;
  } catch (error) {
    console.error("Error finalizing onboarding:", error);
    return false;
  }
}

export async function updateVendorBasicInfo(id, fname, lname, phone) {
  try {
    const { rows } = await pool.query(
      `UPDATE vendors SET fname = COALESCE($1, fname), lname = COALESCE($2, lname), phone = COALESCE($3, phone) WHERE id = $4 RETURNING id, fname, lname, phone, email`,
      [fname, lname, phone, id],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updateVendorBasicInfo:", error);
    return null;
  }
}
