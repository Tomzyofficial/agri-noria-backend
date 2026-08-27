import pool from "../../lib/connect.js";

// Create listings
export async function createListingWithDetails(
  account_id,
  role,
  image,
  public_id,
  listing_name,
  description,
  price,
  location,
  unit_measure,
  available_quantity,
  unit,
  min_quantity,
  category,
  discount,
  attributes,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const listingResult = await client.query(
      `INSERT INTO listings (account_id, role, image, public_id, listing_name, description, price, location, unit_measure, available_quantity, discount, unit, category, min_quantity, attributes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
       RETURNING id`,
      [
        account_id,
        role,
        image,
        public_id,
        listing_name,
        description,
        price,
        location,
        unit_measure,
        available_quantity,
        discount,
        unit,
        category,
        min_quantity,
        attributes,
      ],
    );

    if (listingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Failed to create product listing" };
    }

    await client.query("COMMIT");
    return { success: true, data: listingResult.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating listing:", error);
    return {
      success: false,
      error: "Failed to create product listing",
      data: null,
    };
  } finally {
    client.release();
  }
}

// Fetch all items for a vendor dashboard
export async function fetchListedItems(account_id, page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  const result = await pool.query(
    `SELECT ls.id, ls.account_id, ls.image, ls.listing_name, ls.created_at, ls.price, ls.status, cu.country_code, cu.currency FROM listings ls JOIN country_utils cu ON ls.account_id = cu.vendor_id WHERE ls.account_id = $1 ORDER BY ls.id DESC LIMIT $2 OFFSET $3`,
    [account_id, limit, offset],
  );
  return {
    listings: result.rows,
    page,
    limit,
  };
}

export const getTotalProducts = async (userId) => {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(id) AS total, COUNT(id) FILTER(WHERE status = 'active') AS active_count FROM listings WHERE status = 'active' AND account_id = $1",
      [userId],
    );

    return rows[0];
  } catch {
    return { total: 0, active_count: 0 };
  }
};

// Fetch single item for item edit/view in dashboard by search param
export async function filterItemForSearchParams(account_id, productId) {
  try {
    const result = await pool.query(
      `SELECT ls.*, cu.country_code, cu.currency FROM listings ls JOIN country_utils cu ON ls.account_id = cu.vendor_id WHERE ls.account_id = $1 AND ls.id = $2`,
      [account_id, productId],
    );
    return result.rows[0];
  } catch {
    return null;
  }
}

// Update listing table
export async function updateListings(
  id,
  account_id,
  product_image,
  listing_name,
  description,
  price,
  location,
  unit_measure,
  available_quantity,
  unit,
  min_quantity,
  category,
  discount,
  attributes,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get existing listing data first
    const existingListing = await client.query(
      "SELECT id, image, public_id FROM listings WHERE id = $1 AND account_id = $2 AND status = $3",
      [id, account_id, "active"],
    );

    if (existingListing.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Product not found or not authorized" };
    }

    const current = existingListing.rows[0];

    let mergedImages = null;
    let mergedPublicIds = null;

    if (product_image?.urls?.length) {
      const newImageUrls = product_image.urls;
      const newPublicIds = product_image.publicIds || [];
      const existingImages = Array.isArray(current.image) ? current.image : [];
      const existingPublicIds = Array.isArray(current.public_id)
        ? current.public_id
        : [];

      mergedImages = [...existingImages, ...newImageUrls];
      mergedPublicIds = [...existingPublicIds, ...newPublicIds];
    }

    const result = await client.query(
      `UPDATE listings SET 
       image = COALESCE($1, image),
       public_id = COALESCE($2, public_id),
       listing_name = COALESCE($3, listing_name),
       description = COALESCE($4, description),
       price = COALESCE($5, price),
       location = COALESCE($6, location),
       unit_measure = COALESCE($7, unit_measure),
       available_quantity = COALESCE($8, available_quantity),
       unit = COALESCE($9, unit),
       min_quantity = COALESCE($10, min_quantity),
       category = COALESCE($11, category),
       discount = COALESCE($12, discount),
       attributes = COALESCE($13, attributes),
       updated_at = NOW()
    WHERE id = $14 
    AND account_id = $15 
    AND status = $16 
    RETURNING id, image, listing_name, description, price, location, unit_measure, available_quantity, unit, min_quantity, category, discount, attributes`,
      [
        mergedImages,
        mergedPublicIds,
        listing_name,
        description,
        price,
        location,
        unit_measure,
        available_quantity,
        unit,
        min_quantity,
        category,
        discount,
        attributes,
        id,
        account_id,
        "active",
      ],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Failed to update product listing",
      };
    }

    await client.query("COMMIT");
    return { success: true, data: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating listing:", error);
    return {
      success: false,
      error: "Failed to update product listing",
      data: null,
    };
  } finally {
    client.release();
  }
}

// Delete product per vendor
export async function deleteProduct(productId, id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if product exist and belongs to the vendor
    const productCheck = await client.query(
      "SELECT id, public_id FROM listings WHERE id = $1 AND account_id = $2",
      [productId, id],
    );

    if (productCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        error: "Product not found or not authorized",
        success: false,
      };
    }

    const publicIds = Array.isArray(productCheck.rows[0].public_id)
      ? productCheck.rows[0].public_id
      : [];

    const deleteProductResult = await client.query(
      "DELETE FROM listings WHERE id = $1 AND account_id = $2 RETURNING id",
      [productId, id],
    );

    if (deleteProductResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Failed to delete product" };
    }

    await client.query("COMMIT");

    return { success: true, publicIds };
  } catch (error) {
    await client.query("ROLLBACK");
    return { error: error, success: false };
  } finally {
    client.release();
  }
}
