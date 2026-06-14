import pool from "../../lib/connect.js";

// Select all listed storage facilities
export async function getAllListedStorage(country) {
  try {
    const { rows } = await pool.query(
      `SELECT st.id, st.storage_image, st.storage_name, st.href, st.price, st.description, st.view_count, st.booking_click_count, cu.currency, cu.country_code FROM storage_facility st JOIN country_utils cu ON st.account_id = cu.vendor_id WHERE cu.country_code = $1 ORDER BY id DESC`,
      [country],
    );
    return rows;
  } catch (error) {
    console.error("Error occurred", error);
    return error.message;
  }
}

// Select single storage by href (name)
export async function getSingleListedStorageById(id) {
  try {
    if (!id) {
      return { success: false, message: "Missing id" };
    }

    const { rows } = await pool.query(
      `SELECT sf.id, sf.account_id, sf.storage_image, sf.storage_name, sf.href, sf.description, sf.price, sf.location, sf.storage_type, sf.capacity, sf.available, sf.temperature, sf.features, sf.view_count, sf.booking_click_count,
         v.id AS vendor_id, v.fname, v.lname, v.phone, v.profile_image_url, v.is_verified, cu.currency, cu.country_code 
         FROM storage_facility sf
         LEFT JOIN vendors v ON sf.account_id = v.id
         LEFT JOIN country_utils cu ON cu.vendor_id = sf.account_id
         WHERE sf.id = $1 AND sf.status = 'active' LIMIT 1`,
      [id],
    );

    const storagePerVendor = rows[0] || null;

    if (!storagePerVendor) {
      return { success: false, message: "Not found", storage: [] };
    }

    return { success: true, storage: storagePerVendor };
  } catch (error) {
    return { success: false, message: error.message, storage: null };
  }
}

export async function incrementStorageViewCount(storageId) {
  try {
    const { rows } = await pool.query(
      `UPDATE storage_facility SET view_count = view_count + 1, updated_at = NOW() WHERE id = $1 RETURNING view_count`,
      [storageId],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error incrementing storage view count", error);
    return null;
  }
}

export async function incrementStorageBookingClickCount(storageId) {
  try {
    const { rows } = await pool.query(
      `UPDATE storage_facility SET booking_click_count = booking_click_count + 1, updated_at = NOW() WHERE id = $1 RETURNING booking_click_count`,
      [storageId],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Error incrementing storage booking click count", error);
    return null;
  }
}

// Get storage reviews
export async function getReviews({ listingId, page, pageSize }) {
  const offset = (page - 1) * pageSize;

  const { rows: summaryRows } = await pool.query(
    `SELECT rating, COUNT(*)::int AS count
       FROM reviews
       WHERE listing_id = $1
       GROUP BY rating`,
    [listingId],
  );

  const ratings = {
    total: 0,
    average: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  summaryRows.forEach(({ rating, count }) => {
    ratings.breakdown[rating] = count;
    ratings.total += count;
    ratings.average += rating * count;
  });

  if (ratings.total) {
    ratings.average = Number((ratings.average / ratings.total).toFixed(1));
  }

  //console.log("Ratings summary:", ratings.total);

  const { rows: reviews } = await pool.query(
    `SELECT r.id, r.rating, r.feedback, r.created_at, b.name AS buyer_name
       FROM reviews r
       JOIN buyers b ON r.buyer_id = b.buyer_id
       WHERE r.listing_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
    [listingId, pageSize, offset],
  );

  return { reviews, summary: ratings };
}

// Submit a new product review
export async function submitReview(id, rating, feedback, buyerId) {
  try {
    if (!id) return { success: false, error: "Missing listing id" };

    const ratingInt = Number(rating);
    if (ratingInt < 1 || ratingInt > 5) {
      return { success: false, error: "Rating must be between 1 and 5" };
    }

    const {
      rows: [newReview],
    } = await pool.query(
      `INSERT INTO reviews (listing_id, buyer_id, rating, feedback)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_id, buyer_id)
       DO UPDATE SET rating = EXCLUDED.rating,
                     feedback = EXCLUDED.feedback,
                     updated_at = NOW()
       RETURNING *`,
      [id, buyerId, ratingInt, feedback ?? null],
    );

    return { success: true, newReview };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Internal server error" };
  }
}

// Submit booking request from marketplace to vendor dashboard
export async function submitBookingRequest({ data }) {
  const { target_id, quote_type, full_name, phone, metadata, additional_info } =
    data;
  const result = await pool.query(
    `INSERT INTO quote_requests (target_id, quote_type, full_name, phone, metadata, additional_info) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [target_id, quote_type, full_name, phone, metadata, additional_info],
  );

  return result.rows[0];
}
