import pool from "../../lib/connect.js";
import {
  saveFileToCloudinary,
  deleteFileFromCloudinary,
} from "../../lib/cloudinary.img.js";

export const droneListingsDb = {
  createListing: async (vendorId, listing) => {
    const {
      listingName,
      manufacturer,
      model,
      category,
      listingType,
      location,
      quantity,
      unit,
      description,
      salePrice,
      condition,
      warranty,
      rentalPrice,
      rentalPeriod,
      maxPayload,
      operatingRange,
      cameraType,
      flightTime,
      provideService,
      serviceType,
      image,
    } = listing;

    const client = await pool.connect();

    await client.query("BEGIN");

    try {
      const result = await client.query(
        `
         INSERT INTO listings (
            account_id,
            role,
            listing_name,
            description,
            price,
            location,
            unit,
            available_quantity,
            category
         )
         VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9
         )
         RETURNING id
      `,
        [
          vendorId,
          "drone",
          listingName,
          description,
          salePrice,
          location,
          unit,
          quantity,
          category,
        ],
      );

      if (result.rows[0].id) {
        console.log("saved listing id", result.rows[0].id);
        const saveFileToCloud = image
          ? await saveFileToCloudinary(image, "drones", "image")
          : null;

        const imageUrl = saveFileToCloud
          ? saveFileToCloud.map((item) => item.secure_url)
          : null;

        const publicId = saveFileToCloud
          ? saveFileToCloud.map((item) => item.public_id)
          : null;

        await client.query(
          "UPDATE listings SET product_image = $1, public_id = $2 WHERE id = $3",
          [imageUrl, publicId, result.rows[0].id],
        );

        await client.query(
          "INSERT INTO drone_listing_details (listing_id, manufacturer, model, listing_type, condition, warranty, rental_price, rental_period, max_payload, operating_range, camera_type, flight_time, provide_service, service_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
          [
            result.rows[0].id,
            manufacturer,
            model,
            listingType,
            condition,
            warranty,
            rentalPrice,
            rentalPeriod,
            maxPayload,
            operatingRange,
            cameraType,
            flightTime,
            provideService,
            serviceType,
          ],
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      console.error("Error creating listing:", error);
      await client.query("ROLLBACK");
      return false;
    } finally {
      client.release();
    }
  },

  /**
   * Get vendor inventory
   */
  getVendorInventory: async (vendorId, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;

    const listings = await pool.query(
      `
         SELECT ls.id, ls.account_id, ls.product_image, ls.listing_name, ls.description, ls.price, ls.product_status, cu.country_code, cu.currency, dld.rental_price FROM listings ls LEFT JOIN country_utils cu ON ls.account_id = cu.vendor_id LEFT JOIN drone_listing_details dld ON ls.id = dld.listing_id WHERE ls.account_id = $1 ORDER BY ls.id DESC LIMIT $2 OFFSET $3
      `,
      [vendorId, limit, offset],
    );

    return {
      listings: listings.rows,
      // total: Number(total.rows[0].count),
      page,
      limit,
    };
  },

  /**
   * Get single listing
   */
  getSingleListing: async (listingId, vendorId) => {
    const result = await pool.query(
      `
         SELECT
           ls.id,
           ls.account_id,
           ls.role,
           ls.product_image,
           ls.public_id,
           ls.listing_name,
           ls.description,
           ls.price,
           ls.location,
           ls.created_at,
           ls.updated_at,
           ls.product_status,
           ls.available_quantity,
           ls.unit,
           ls.category,
           cu.country_code,
           cu.currency,
           dld.id AS drone_detail_id,
           dld.listing_id AS drone_listing_id,
           dld.manufacturer,
           dld.model,
           dld.listing_type,
           dld.condition,
           dld.warranty,
           dld.rental_price,
           dld.rental_period,
           dld.max_payload,
           dld.operating_range,
           dld.camera_type,
           dld.flight_time,
           dld.provide_service,
           dld.service_type
         FROM listings ls
         LEFT JOIN country_utils cu ON cu.vendor_id = ls.account_id
         LEFT JOIN drone_listing_details dld ON dld.listing_id = ls.id
         WHERE ls.id = $1 AND ls.account_id = $2
         LIMIT 1
      `,
      [listingId, vendorId],
    );

    //   console.log(result.rows[0]);
    return result.rows[0] || null;
  },

  /**
   * Update listing (partial updates via COALESCE)
   */
  updateListing: async (listingId, vendorId, listing) => {
    const {
      listingName,
      manufacturer,
      model,
      category,
      listingType,
      location,
      quantity,
      unit,
      description,
      salePrice,
      condition,
      warranty,
      rentalPrice,
      rentalPeriod,
      maxPayload,
      operatingRange,
      cameraType,
      flightTime,
      provideService,
      serviceType,
      image,
    } = listing;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT product_image, public_id FROM listings WHERE id = $1 AND account_id = $2",
        [listingId, vendorId],
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      let imageUrls = existing.rows[0].product_image;
      let publicIds = existing.rows[0].public_id;

      if (image?.length) {
        const saved = await saveFileToCloudinary(image, "drones", "image");
        const newUrls = saved.map((item) => item.secure_url);
        const newIds = saved.map((item) => item.public_id);
        imageUrls = [...(imageUrls || []), ...newUrls];
        publicIds = [...(publicIds || []), ...newIds];
      }

      const provideServiceValue =
        provideService === undefined
          ? undefined
          : provideService === true ||
            provideService === "true" ||
            provideService === "on";

      const result = await client.query(
        `
         UPDATE listings
         SET
            product_image = COALESCE($1, product_image),
            public_id = COALESCE($2, public_id),
            listing_name = COALESCE($3, listing_name),
            description = COALESCE($4, description),
            price = COALESCE($5, price),
            location = COALESCE($6, location),
            available_quantity = COALESCE($7, available_quantity),
            unit = COALESCE($8, unit),
            category = COALESCE($9, category),
            updated_at = NOW()
         WHERE id = $10 AND account_id = $11
            RETURNING *
      `,
        [
          image?.length ? imageUrls : null,
          image?.length ? publicIds : null,
          listingName ?? null,
          description ?? null,
          salePrice ?? null,
          location ?? null,
          quantity ?? null,
          unit ?? null,
          category ?? null,
          listingId,
          vendorId,
        ],
      );

      if (result.rows.length === 0) {
        console.log("failed to update listing", result.rows);
        await client.query("ROLLBACK");
        return null;
      }

      //  Update drone_listing_details table
      const updateDetails = await client.query(
        `
         UPDATE drone_listing_details
         SET
            manufacturer = COALESCE($1, manufacturer),
            model = COALESCE($2, model),
            listing_type = COALESCE($3, listing_type),
            condition = COALESCE($4, condition),
            warranty = COALESCE($5, warranty),
            rental_price = COALESCE($6, rental_price),
            rental_period = COALESCE($7, rental_period),
            max_payload = COALESCE($8, max_payload),
            operating_range = COALESCE($9, operating_range),
            camera_type = COALESCE($10, camera_type),
            flight_time = COALESCE($11, flight_time),
            provide_service = COALESCE($12, provide_service),
            service_type = COALESCE($13, service_type)
          WHERE listing_id = $14
          RETURNING *`,
        [
          manufacturer ?? null,
          model ?? null,
          listingType ?? null,
          condition ?? null,
          warranty ?? null,
          rentalPrice ?? null,
          rentalPeriod ?? null,
          maxPayload ?? null,
          operatingRange ?? null,
          cameraType ?? null,
          flightTime ?? null,
          provideServiceValue,
          serviceType ?? null,
          listingId,
        ],
      );

      if (updateDetails.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query("COMMIT");

      /*  const updatedListing = await pool.query(
        `
         SELECT
           ls.id,
           ls.account_id,
           ls.role,
           ls.product_image,
           ls.public_id,
           ls.listing_name,
           ls.description,
           ls.price,
           ls.location,
           ls.created_at,
           ls.updated_at,
           ls.product_status,
           ls.available_quantity,
           ls.unit,
           ls.category,
           cu.country_code,
           cu.currency,
           dld.id AS drone_detail_id,
           dld.listing_id AS drone_listing_id,
           dld.manufacturer,
           dld.model,
           dld.listing_type,
           dld.condition,
           dld.warranty,
           dld.rental_price,
           dld.rental_period,
           dld.max_payload,
           dld.operating_range,
           dld.camera_type,
           dld.flight_time,
           dld.provide_service,
           dld.service_type
         FROM listings ls
         LEFT JOIN country_utils cu ON cu.vendor_id = ls.account_id
         LEFT JOIN drone_listing_details dld ON dld.listing_id = ls.id
         WHERE ls.id = $1 AND ls.account_id = $2
         LIMIT 1
        `,
        [listingId, vendorId],
      ); */

      // return updatedListing.rows[0] || null;
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      return null;
    } finally {
      client.release();
    }
  },

  /**
   * Delete listing
   */
  deleteListing: async (listingId, vendorId) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if product exist and belongs to the vendor
      const productCheck = await client.query(
        "SELECT public_id FROM listings WHERE id = $1 AND account_id = $2",
        [listingId, vendorId],
      );

      if (productCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return {
          error: "Product not found or not authorized",
          success: false,
        };
      }

      const publicId = productCheck.rows[0].public_id;

      if (publicId.length > 0) {
        try {
          await Promise.all(
            publicId.map(async (element) => {
              await deleteFileFromCloudinary(element);
            }),
          );
        } catch {
          await client.query("ROLLBACK");
          return { error: "Failed to delete drone image", success: false };
        }
      }

      await pool.query(
        `DELETE FROM listings WHERE id = $1 AND account_id = $2`,
        [listingId, vendorId],
      );

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      console.log(error);
      await client.query("ROLLBACK");
      return { success: false };
    } finally {
      client.release();
    }
  },

  /**
   * Dashboard statistics
   */
  getDashboardStats: async (vendorId) => {
    const result = await pool.query(
      "SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE product_status='active') AS active FROM listings WHERE account_id=$1",
      [vendorId],
    );

    return result.rows[0];
  },

  /**
   * Get all active listings (public)
   */
  getPublicListings: async (page = 1, limit = 12) => {
    const offset = (page - 1) * limit;

    const listings = await pool.query(
      `
         SELECT ls.id, ls.listing_name, dld.manufacturer, dld.model, ls.category, dld.listing_type, ls.location, ls.available_quantity, ls.unit, ls.description, ls.price, dld.condition, dld.warranty, dld.rental_price, dld.rental_period, dld.max_payload, dld.operating_range, dld.camera_type, dld.flight_time, dld.provide_service, dld.service_type, ls.product_image, ls.product_status, ls.created_at, ls.updated_at, cu.country_code, cu.currency
         FROM listings ls
         LEFT JOIN drone_listing_details dld ON ls.id = dld.listing_id
         LEFT JOIN country_utils cu ON ls.account_id = cu.vendor_id
         WHERE ls.product_status = 'active' AND ls.role = 'drone'
         ORDER BY ls.created_at DESC
         LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    const total = await pool.query(
      `
         SELECT COUNT(*) AS count
         FROM listings
         WHERE product_status = 'active'
      `,
    );

    return {
      listings: listings.rows,
      total: Number(total.rows[0].count),
      page,
      limit,
    };
  },

  /**
   * Get single public listing by ID
   */
  getPublicSingleListing: async (listingId) => {
    const result = await pool.query(
      `
         SELECT ls.id AS listing_id, ls.*, dld.*, cu.country_code, cu.currency, cu.country_name, cu.state_name
         FROM listings ls
         LEFT JOIN drone_listing_details dld ON ls.id = dld.listing_id
         LEFT JOIN country_utils cu ON ls.account_id = cu.vendor_id
         WHERE ls.id = $1 AND ls.product_status = 'active'
      `,
      [listingId],
    );

    return result.rows[0] || null;
  },
};
