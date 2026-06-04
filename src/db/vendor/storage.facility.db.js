import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";
import pool from "../../lib/connect.js";

// Create new storage facility for vendor dashboard
export async function createStorageFacility(
  account_id,
  storage_image,
  storage_name,
  href,
  storage_type,
  location,
  capacity,
  available,
  price,
  temperature,
  description,
  features,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure features is an array for PostgreSQL TEXT[] type
    const featuresArray = Array.isArray(features) ? features : [];

    const result = await client.query(
      `INSERT INTO storage_facility 
          (account_id, storage_image, storage_name, href, storage_type, location, 
           capacity, available, price, temperature, description, features) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
          RETURNING *`,
      [
        account_id,
        storage_image,
        storage_name,
        href,
        storage_type,
        location,
        capacity,
        available,
        price,
        temperature,
        description,
        featuresArray,
      ],
    );

    if (!result.rows[0]) {
      return { success: false, error: "Failed to create storage facility" };
    }

    await client.query("COMMIT"); // Commit the transaction
    return { success: true, data: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK"); // Rollback on error
    return {
      success: false,
      error: error.message || "Internal server error. Try again.",
    };
  } finally {
    client.release(); // Release the client back to the pool
  }
}

// Fetch all storage facility for a vendor dashboard
export async function fetchListedStorage(account_id) {
  const result = await pool.query(
    `SELECT sf.id, sf.account_id, sf.storage_image, sf.storage_name, sf.description, sf.status, sf.price, sf.storage_type, sf.features, cu.currency, cu.country_code FROM storage_facility sf JOIN country_utils cu ON sf.account_id = cu.vendor_id WHERE sf.account_id = $1 ORDER BY sf.id DESC`,
    [account_id],
  );
  return result.rows;
}

export const getStorageStats = async (userId) => {
  try {
    const statsQuery = `SELECT
         (SELECT COUNT(*) FROM storage_facility WHERE status = 'active' AND account_id = $1) AS total,
         (SELECT COALESCE(SUM(view_count), 0) FROM storage_facility WHERE status = 'active' AND account_id = $1) AS view_count,
         (SELECT COALESCE(SUM(booking_click_count), 0) FROM storage_facility WHERE status = 'active' AND account_id = $1) AS booking_click_count,
         (SELECT COUNT(*) FROM quote_requests qr INNER JOIN storage_facility sf ON sf.id = qr.target_id WHERE sf.status = 'active' AND sf.account_id = $1) AS quote_requests_count`;

    const statsResult = await pool.query(statsQuery, [userId]);

    return {
      total: statsResult.rows[0].total || 0,
      view_count: statsResult.rows[0].view_count || 0,
      booking_click_count: statsResult.rows[0].booking_click_count || 0,
      quote_requests_count: statsResult.rows[0].quote_requests_count || 0,
    };
  } catch (error) {
    console.log("error", error);
    return {
      total: 0,
      view_count: 0,
      booking_click_count: 0,
      quote_requests_count: 0,
      requests: [],
    };
  }
};

// Get all the quote requests for the vendor's storage facilities
export async function getQuoteRequests(accountId) {
  const quoteRequestsQuery = `SELECT qr.id as quote_request_id, qr.target_id, qr.full_name, qr.phone, qr.metadata, qr.created_at, qr.status, qr.additional_info, sf.storage_name, sf.storage_type, sf.location FROM quote_requests qr 
    INNER JOIN storage_facility sf ON sf.id = qr.target_id WHERE sf.status = 'active' AND sf.account_id = $1 ORDER BY qr.created_at DESC LIMIT 5`;

  const allQuoteRequestQuery = `SELECT qr.id AS quote_request_id, qr.target_id, qr.full_name,
      qr.phone, qr.metadata, qr.created_at, qr.status, qr.additional_info, sf.storage_name,
       sf.storage_type, sf.location
       FROM quote_requests qr
       INNER JOIN storage_facility sf ON sf.id = qr.target_id
       WHERE sf.status = 'active' AND sf.account_id = $1
       ORDER BY qr.created_at DESC`;

  const [quoteRequestsResult, allQuoteRequestsResult] = await Promise.all([
    pool.query(quoteRequestsQuery, [accountId]),
    pool.query(allQuoteRequestQuery, [accountId]),
  ]);

  return {
    success: true,
    quoteRequests: quoteRequestsResult.rows,
    allQuoteRequests: allQuoteRequestsResult.rows,
  };
}

// Update Quote request status to contacted when vendor clicks contact button
export async function updateQuoteRequestStatus(
  quoteRequestId,
  status,
  accountId,
) {
  try {
    const { rows } = await pool.query(
      `UPDATE quote_requests  SET status = $1 FROM
         storage_facility sf  WHERE sf.id = quote_requests.target_id AND quote_requests.id = $2 AND sf.account_id = $3
         RETURNING *`,
      [status, quoteRequestId, accountId],
    );
    return { success: true, data: rows[0] };
  } catch (error) {
    return { success: false, error: "Internal server error. Try again." };
  }
}

// Fetch single item for item edit/view in dashboard by search param
export async function filterItemForSearchParams(account_id, storageId) {
  const result = await pool.query(
    `SELECT sf.*, cu.country_code, cu.currency FROM storage_facility sf JOIN country_utils cu ON sf.account_id = cu.vendor_id WHERE sf.account_id = $1 AND sf.id = $2 LIMIT 1`,
    [account_id, storageId],
  );
  return result.rows[0];
}

// Update storage facility
export async function updateStorage(account_id, storageId, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // First, verify the storage exists and belongs to the account
    const checkQuery =
      "SELECT id FROM storage_facility WHERE account_id = $1 AND id = $2";
    const checkResult = await client.query(checkQuery, [account_id, storageId]);

    if (checkResult.rows.length === 0) {
      console.error(
        "No storage found with ID:",
        storageId,
        "for account:",
        account_id,
      );
      return { success: false, error: "Storage not found or not authorized" };
    }

    // Ensure features is properly formatted as a PostgreSQL array
    const features = Array.isArray(data.features)
      ? data.features
      : typeof data.features === "string"
        ? JSON.parse(data.features)
        : [];

    const updateQuery = `
         UPDATE storage_facility SET 
            storage_image = COALESCE($1, storage_image), 
            storage_name = COALESCE($2, storage_name), 
            href = COALESCE($3, href), 
            storage_type = COALESCE($4, storage_type), 
            location = COALESCE($5, location), 
            capacity = COALESCE($6, capacity), 
            available = COALESCE($7, available), 
            price = COALESCE($8, price), 
            temperature = COALESCE($9, temperature), 
            description = COALESCE($10, description), 
            features = COALESCE($11, features),
            updated_at = NOW()
         WHERE account_id = $12 AND id = $13 
         RETURNING *`;

    const result = await client.query(updateQuery, [
      data.storage_image,
      data.storage_name,
      data.storage_name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
      data.storage_type,
      data.location,
      data.capacity,
      data.available,
      data.price,
      data.temperature,
      data.description,
      features,
      account_id,
      storageId,
    ]);

    await client.query("COMMIT");
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("Error updating storage facility:", error);
    await client.query("ROLLBACK");
    return {
      success: false,
      error: "Failed to update storage facility",
      data: null,
    };
  } finally {
    client.release();
  }
}

// Delete listed stroage facility
export async function deleteStorage(storageId, account_id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // First, verify the storage exists and belongs to the account
    const checkQuery =
      "SELECT id, storage_image FROM storage_facility WHERE account_id = $1 AND id = $2";
    const checkResult = await client.query(checkQuery, [account_id, storageId]);

    if (checkResult.rows.length === 0) {
      return {
        error: "Storage facility not found or you don't have permission",
        success: false,
      };
    }

    const storage = checkResult.rows[0];
    const imageUrl = storage.storage_image;

    if (imageUrl && imageUrl.includes("cloudinary.com")) {
      try {
        const deleteResult = await deleteFileFromCloudinary(imageUrl);
        if (deleteResult.result !== "ok") {
          await client.query("ROLLBACK");
          return {
            error:
              deleteResult.message || "Failed to delete storage facility image",
            success: false,
          };
        }
      } catch {
        await client.query("ROLLBACK");
        return {
          error: "Failed to delete storage facility image",
          success: false,
        };
      }
    }

    const deleteQuery =
      "DELETE FROM storage_facility WHERE account_id = $1 AND id = $2 RETURNING *";

    const deleteResult = await client.query(deleteQuery, [
      account_id,
      storageId,
    ]);

    if (deleteResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Failed to delete storage facility" };
    }

    await client.query("COMMIT");

    return { message: "Storage facility deleted successfully", success: true };
  } catch {
    await client.query("ROLLBACK");
    return { error: "Internal server error. Try again.", success: false };
  } finally {
    client.release();
  }
}
