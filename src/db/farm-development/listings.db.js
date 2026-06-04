import pool from "../../lib/connect.js";

export async function getListings(
  status = "active",
  companyId = null,
  category = null,
) {
  try {
    let query = `
      SELECT 
        sl.id, sl.company_id, sl.category_id, sl.title, sl.description,
        sl.price, sl.price_type, sl.location, sl.status, sl.featured,
        sl.views_count, sl.created_at, sl.updated_at,
        sc.name as category_name,
        array_agg(li.image_url) as images
      FROM service_listings sl
      LEFT JOIN service_categories sc ON sl.category_id = sc.id
      LEFT JOIN listing_images li ON sl.id = li.listing_id
      WHERE sl.status = $1
    `;
    const params = [status];
    let paramCount = 1;

    if (companyId) {
      paramCount++;
      query += ` AND sl.company_id = $${paramCount}`;
      params.push(parseInt(companyId));
    }

    if (category) {
      paramCount++;
      query += ` AND sc.name = $${paramCount}`;
      params.push(category);
    }

    query += ` GROUP BY sl.id, sc.name ORDER BY sl.created_at DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error("Database error in getListings:", error);
    return null;
  }
}

export async function createListing(
  companyId,
  categoryId,
  title,
  description,
  price,
  priceType,
  location,
) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO service_listings (company_id, category_id, title, description, price, price_type, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        companyId,
        categoryId,
        title,
        description || "",
        price || null,
        priceType || "fixed",
        location || "",
        "active",
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
      `SELECT 
        sl.id, sl.company_id, sl.category_id, sl.title, sl.description,
        sl.price, sl.price_type, sl.location, sl.status, sl.featured,
        sl.views_count, sl.created_at, sl.updated_at,
        sc.name as category_name,
        c.name as company_name
      FROM service_listings sl
      LEFT JOIN service_categories sc ON sl.category_id = sc.id
      LEFT JOIN companies c ON sl.company_id = c.id
      WHERE sl.id = $1`,
      [parseInt(listingId)],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getListingById:", error);
    return null;
  }
}

export async function getListingImages(listingId) {
  try {
    const { rows } = await pool.query(
      "SELECT id, image_url, alt_text, display_order FROM listing_images WHERE listing_id = $1 ORDER BY display_order",
      [parseInt(listingId)],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getListingImages:", error);
    return [];
  }
}

export async function recordListingView(listingId, ipAddress, userAgent) {
  try {
    await pool.query(
      "INSERT INTO listing_views (listing_id, ip_address, user_agent) VALUES ($1, $2, $3)",
      [parseInt(listingId), ipAddress || "unknown", userAgent || "unknown"],
    );

    // Increment view count
    await pool.query(
      "UPDATE service_listings SET views_count = views_count + 1 WHERE id = $1",
      [parseInt(listingId)],
    );
    return true;
  } catch (error) {
    console.error("Database error in recordListingView:", error);
    return false;
  }
}

export async function updateListing(
  listingId,
  title,
  description,
  price,
  priceType,
  location,
  status,
  featured,
) {
  try {
    const { rows } = await pool.query(
      `UPDATE service_listings 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           price_type = COALESCE($4, price_type),
           location = COALESCE($5, location),
           status = COALESCE($6, status),
           featured = COALESCE($7, featured),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        title,
        description,
        price,
        priceType,
        location,
        status,
        featured,
        parseInt(listingId),
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updateListing:", error);
    return null;
  }
}

export async function deleteListing(listingId) {
  try {
    // Delete images first
    await pool.query("DELETE FROM listing_images WHERE listing_id = $1", [
      parseInt(listingId),
    ]);
    // Delete views
    await pool.query("DELETE FROM listing_views WHERE listing_id = $1", [
      parseInt(listingId),
    ]);
    // Delete listing
    const { rows } = await pool.query(
      "DELETE FROM service_listings WHERE id = $1 RETURNING id",
      [parseInt(listingId)],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in deleteListing:", error);
    return null;
  }
}
