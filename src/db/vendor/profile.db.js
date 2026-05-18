import pool from "../../lib/connect.js";

export async function uploadVendorProfileImage(id, profile_image_url) {
   try {
      const existing = await pool.query(`SELECT id FROM vendors WHERE id = $1 LIMIT 1`, [id]);
      if (existing.rows.length > 0) {
         const updated = await pool.query(
            `UPDATE vendors SET profile_image_url = $1 WHERE id = $2 RETURNING profile_image_url`,
            [profile_image_url, id],
         );
         return updated.rows[0]?.profile_image_url || null;
      }
   } catch (error) {
      console.error("Database error in uploadVendorProfileImage in profile db.js:", error);
      return error;
   }
}

// Retrieve updated profile image
export async function getUpdatedProfileImage(id) {
   const { rows } = await pool.query(`SELECT profile_image_url FROM vendors WHERE id = $1`, [id]);
   return rows[0]?.profile_image_url || null;
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
      const existing = await pool.query(`SELECT id FROM vendor_documents WHERE vendor_id = $1 LIMIT 1`, [vendor_id]);
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

         // Sync onboarding_status to vendors table
         await pool.query(
            "UPDATE vendors SET onboarding_status = 'completed' WHERE id = $1",
            [vendor_id]
         );

         return inserted.rows[0];
      }
   } catch (error) {
      console.error("Database error in upsertVendorDocuments:", error);
      return null;
   }
}

// Upsert vendor bank account (by vendor_id)
export async function upsertVendorBankAccount(vendor_id, bank_name, account_name, account_number) {
   try {
      const existing = await pool.query(`SELECT id FROM vendor_bank_accounts WHERE vendor_id = $1 LIMIT 1`, [
         vendor_id,
      ]);
      if (existing.rows.length > 0) {
         // Update existing record - only update fields that are provided (not null)
         const updated = await pool.query(
            `UPDATE vendor_bank_accounts SET bank_name = COALESCE($1, bank_name), account_name = COALESCE($2, account_name), account_number = COALESCE($3, account_number) WHERE vendor_id = $4 RETURNING *`,
            [bank_name ?? null, account_name ?? null, account_number ?? null, vendor_id],
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

// Get the vendor's documents row per vendor_id
export async function getVendorProfileInfo(id) {
   const { rows } = await pool.query(
      "SELECT vendor_id, business_name, hot_line_phone_number, address, business_desc, id_front_status, id_back_status, license_status FROM vendor_documents WHERE vendor_id = $1 ORDER BY id ASC LIMIT 1",
      [id],
   );

   const result = rows?.[0] || null;

   if (!result) {
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

   return {
      success: true,
      data: {
         rows: result,
         id_front_status: result.id_front_status,
         id_back_status: result.id_back_status,
         license_status: result.license_status,
         business_name: result.business_name,
         hot_line_phone_number: result.hot_line_phone_number,
         address: result.address,
         business_desc: result.business_desc,
      },
   };
}

// Check for verified vendor
export async function checkVerifiedVendor(id) {
   try {
      const { rows: verified } = await pool.query("SELECT is_verified FROM vendors WHERE id = $1", [id]);

      const isVerified = verified[0]?.is_verified === true;

      return isVerified;
   } catch (error) {
      console.error("Database error in checkVerifiedVendor in profile db.js:", error);
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
         [vendor_id]
      );
      return true;
   } catch (error) {
      console.error("Error finalizing onboarding:", error);
      return false;
   }
}
