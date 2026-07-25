import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";
import pool from "../../lib/connect.js";

export async function getListings(vendorId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, featured_image, status FROM farm_dev_service_listings WHERE status = 'active' AND vendor_id = $1`,
      [vendorId],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getListings:", error);
    return null;
  }
}

export async function createListing(data) {
  const client = await pool.connect();
  try {
    const {
      vendorId,
      title,
      category,
      description,
      location,
      scope,
      price_type,
      min_budget,
      max_budget,
      duration,
      featured_image,
    } = data;

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { rows } = await pool.query(
      `INSERT INTO farm_dev_service_listings (
        vendor_id, title, slug, category, description, location, scope, 
        price_type, min_budget, max_budget, duration
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        vendorId,
        title,
        slug,
        category,
        description,
        location,
        scope,
        price_type,
        min_budget,
        max_budget,
        duration,
      ],
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Failed to create listing" };
    }

    const saveFeaturedImage = featured_image
      ? await saveFileToCloudinary(
          featured_image,
          "farm_dev_featured_images",
          "image",
        )
      : null;

    const imageUrl = saveFeaturedImage ? saveFeaturedImage.secure_url : null;
    const publicId = saveFeaturedImage ? saveFeaturedImage.public_id : null;

    if (imageUrl) {
      await client.query(
        "UPDATE farm_dev_service_listings SET featured_image = $1, public_id = $2 WHERE id = $3",
        [imageUrl, publicId, rows[0].id],
      );
      await client.query("COMMIT");
      return { success: true };
    }
  } catch (error) {
    console.error("Database error in createListing:", error);
    await client.query("ROLLBACK");
    return {
      success: false,
      error: "Internal server error. Please try again later.",
    };
  } finally {
    client.release();
  }
}

export async function getListingById(listingId) {
  try {
    const { rows } = await pool.query(
      `SELECT fd.*, cu.currency, cu.country_code FROM farm_dev_service_listings fd
       LEFT JOIN country_utils cu ON cu.vendor_id = fd.vendor_id
       WHERE fd.id = $1 LIMIT 1`,
      [listingId],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getListingById:", error);
    return null;
  }
}

export async function updateListing(listingId, vendorId, updates) {
  const {
    title,
    category,
    description,
    location,
    scope,
    price_type,
    min_budget,
    max_budget,
    duration,
    featured_image,
  } = updates;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingPublicId = await client.query(
      "SELECT public_id FROM farm_dev_service_listings WHERE id = $1 AND vendor_id = $2 LIMIT 1",
      [listingId, vendorId],
    );

    if (existingPublicId.rows.length > 0 && updates.featured_image) {
      await deleteFileFromCloudinary(existingPublicId.rows[0].public_id);
    }

    const saveImageToCloud = featured_image
      ? await saveFileToCloudinary(
          featured_image,
          "farm_dev_featured_images",
          "image",
        )
      : null;

    const savedImage = saveImageToCloud ? saveImageToCloud : null;

    const imageUrl = savedImage?.secure_url;
    const publicId = savedImage?.public_id;

    const slug = title
      ? title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : undefined;

    const { rows } = await client.query(
      `UPDATE farm_dev_service_listings
     SET title = COALESCE($1, title),
         slug = COALESCE($2, slug),
         category = COALESCE($3, category),
         description = COALESCE($4, description),
         location = COALESCE($5, location),
         scope = COALESCE($6, scope),
         price_type = COALESCE($7, price_type),
         min_budget = COALESCE($8, min_budget),
         max_budget = COALESCE($9, max_budget),
         duration = COALESCE($10, duration),
         featured_image = COALESCE($11, featured_image),
         public_id = COALESCE($12, public_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13 AND vendor_id = $14
     RETURNING *`,
      [
        title,
        slug,
        category,
        description,
        location,
        scope,
        price_type,
        min_budget,
        max_budget,
        duration,
        imageUrl,
        publicId,
        listingId,
        vendorId,
      ],
    );

    if (rows.length > 0) {
      await client.query("COMMIT");
      return { success: true };
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error in updateListing:", error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

export async function deleteListing(listingId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingPublicId = await client.query(
      "SELECT public_id FROM farm_dev_service_listings WHERE id = $1 LIMIT 1",
      [listingId],
    );

    if (existingPublicId.rows.length > 0) {
      await deleteFileFromCloudinary(existingPublicId.rows[0].public_id);
    }
    const { rows } = await client.query(
      "DELETE FROM farm_dev_service_listings WHERE id = $1 RETURNING id",
      [listingId],
    );
    await client.query("COMMIT");
    return rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database error in deleteListing:", error);
    return null;
  }
}
