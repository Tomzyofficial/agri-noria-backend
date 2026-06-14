import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";
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
      gallery_images,
    } = data;

    // Generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { rows } = await pool.query(
      `INSERT INTO farm_dev_service_listings (
        vendor_id, title, slug, category, description, location, scope, 
        price_type, min_budget, max_budget, duration, featured_image, gallery_images
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
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
        featured_image,
        gallery_images,
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in createListing:", error);
    return null;
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

export async function recordListingView(listingId, ipAddress, userAgent) {
  try {
    await pool.query(
      `UPDATE service_listings
       SET views_count = views_count + 1,
           metadata = jsonb_set(
             metadata,
             '{viewEvents}',
             COALESCE(metadata->'viewEvents', '[]'::jsonb) || $2::jsonb,
             true
           )
       WHERE id = $1 OR slug = $1`,
      [
        listingId,
        JSON.stringify([
          {
            ipAddress: ipAddress || "unknown",
            userAgent: userAgent || "unknown",
            viewedAt: new Date().toISOString(),
          },
        ]),
      ],
    );
    return true;
  } catch (error) {
    console.error("Database error in recordListingView:", error);
    return false;
  }
}

export async function updateListing(listingId, vendorId, updates) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingImage = await client.query(
      "SELECT featured_image, gallery_images FROM farm_dev_service_listings WHERE id = $1 LIMIT 1",
      [listingId],
    );

    const existingGallery = existingImage.rows[0].gallery_images || [];

    if (existingImage.rows.length > 0 && updates.featured_image) {
      await deleteFileFromCloudinary(existingImage.rows[0].featured_image);
    }

    if (
      Array.isArray(updates.gallery_images) &&
      updates.gallery_images.length > 0
    ) {
      updates.gallery_images = [...existingGallery, ...updates.gallery_images];
    }

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
      gallery_images,
    } = updates;

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
         gallery_images = COALESCE($12, gallery_images),
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
        featured_image,
        gallery_images,
        listingId,
        vendorId,
      ],
    );

    await client.query("COMMIT");
    return rows[0] || null;
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
    const existingImage = await client.query(
      "SELECT featured_image, gallery_images FROM farm_dev_service_listings WHERE id = $1 LIMIT 1",
      [listingId],
    );

    if (existingImage.rows.length > 0) {
      await Promise.all([
        existingImage.rows[0].featured_image &&
          deleteFileFromCloudinary(existingImage.rows[0].featured_image),
        ...existingImage.rows[0].gallery_images.map((url) =>
          deleteFileFromCloudinary(url),
        ),
      ]);
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
