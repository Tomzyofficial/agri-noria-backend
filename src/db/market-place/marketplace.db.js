import pool from "../../lib/connect.js";

// Select all marketplace products
export async function getAllMarketplaceProducts(country) {
   try {
      const { rows } = await pool.query(
         `SELECT ls.id, ls.product_image, ls.listing_name, ls.price, ls.description, cu.currency, cu.country_code FROM listings ls JOIN country_utils cu ON ls.account_id = cu.vendor_id WHERE cu.country_code = $1 ORDER BY ls.id DESC`,
         [country],
      );
      return rows;
   } catch (error) {
      console.error("Error occurred", error.message);
      return [];
   }
}

// Select single marketplace product alongside details
export async function getSingleMarketplaceProduct(id) {
   try {
      if (!id) {
         return { success: false, message: "Missing id" };
      }

      const { rows } = await pool.query(
         `SELECT ls.id AS listing_id, ls.*, v.fname, v.lname, v.phone, v.profile_image_url, v.is_verified, cu.country_code, cu.currency
         FROM listings ls JOIN vendors v ON ls.account_id = v.id JOIN country_utils cu ON v.id = cu.vendor_id
         WHERE ls.id = $1 LIMIT 1`,
         [id],
      );

      const productPerVendor = rows[0] || null;

      if (!productPerVendor) {
         return { success: false, message: "Not found" };
      }
      return { success: true, product: productPerVendor };
   } catch (error) {
      return { success: false, message: String(error), product: null };
   }
}

// Get product reviews
export async function getReviews({ listingId, page, pageSize }) {
   const offset = (page - 1) * pageSize;

   const { rows: summaryRows } = await pool.query(
      `SELECT rating, COUNT(*)::int AS count
       FROM reviews
       WHERE listing_id = $1
       GROUP BY rating`,
      [listingId],
   );

   let ratings = {
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
