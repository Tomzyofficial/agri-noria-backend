import pool from "../../lib/connect.js";
import {
  saveFileToCloudinary,
  deleteFileFromCloudinary,
  deleteFile,
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
         INSERT INTO drone_listings (
            vendor_id,
            listing_name,
            manufacturer,
            model,
            category,
            listing_type,
            location,
            quantity,
            unit,
            description,
            sale_price,
            condition,
            warranty,
            rental_price,
            rental_period,
            max_payload,
            operating_range,
            camera_type,
            flight_time,
            provide_service,
            service_type
         )
         VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
         )
         RETURNING id
      `,
        [
          vendorId,
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
        ],
      );

      if (result.rows[0].id) {
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
          "UPDATE drone_listings SET image = $1, public_id = $2 WHERE id = $3",
          [imageUrl, publicId, result.rows[0].id],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      client.query("ROLLBACK");
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
         SELECT dl.id, dl.listing_name, dl.status, dl.sale_price, dl.rental_price, dl.image, dl.description, cu.country_code, cu.currency FROM drone_listings dl
         LEFT JOIN country_utils cu ON dl.vendor_id = cu.vendor_id WHERE dl.vendor_id = $1 ORDER BY dl.created_at DESC LIMIT $2 OFFSET $3
      `,
      [vendorId, limit, offset],
    );

    //  const total = await pool.query(
    //    `
    //        SELECT COUNT(*) AS count
    //        FROM drone_listings
    //        WHERE vendor_id=$1
    //     `,
    //    [vendorId],
    //  );

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
         SELECT dl.*, cu.country_code, cu.currency
         FROM drone_listings dl
         LEFT JOIN country_utils cu ON dl.vendor_id = cu.vendor_id
         WHERE dl.id = $1 AND dl.vendor_id = $2
      `,
      [listingId, vendorId],
    );

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
        "SELECT image, public_id FROM drone_listings WHERE id = $1 AND vendor_id = $2",
        [listingId, vendorId],
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      let imageUrls = existing.rows[0].image;
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
         UPDATE drone_listings
         SET
            listing_name = COALESCE($1, listing_name),
            manufacturer = COALESCE($2, manufacturer),
            model = COALESCE($3, model),
            category = COALESCE($4, category),
            listing_type = COALESCE($5, listing_type),
            location = COALESCE($6, location),
            quantity = COALESCE($7, quantity),
            unit = COALESCE($8, unit),
            description = COALESCE($9, description),
            sale_price = COALESCE($10, sale_price),
            condition = COALESCE($11, condition),
            warranty = COALESCE($12, warranty),
            rental_price = COALESCE($13, rental_price),
            rental_period = COALESCE($14, rental_period),
            max_payload = COALESCE($15, max_payload),
            operating_range = COALESCE($16, operating_range),
            camera_type = COALESCE($17, camera_type),
            flight_time = COALESCE($18, flight_time),
            provide_service = COALESCE($19, provide_service),
            service_type = COALESCE($20, service_type),
            image = COALESCE($21, image),
            public_id = COALESCE($22, public_id),
            updated_at = NOW()
         WHERE id = $23 AND vendor_id = $24
         RETURNING *
      `,
        [
          listingName ?? null,
          manufacturer ?? null,
          model ?? null,
          category ?? null,
          listingType ?? null,
          location ?? null,
          quantity ?? null,
          unit ?? null,
          description ?? null,
          salePrice ?? null,
          condition ?? null,
          warranty ?? null,
          rentalPrice ?? null,
          rentalPeriod ?? null,
          maxPayload ?? null,
          operatingRange ?? null,
          cameraType ?? null,
          flightTime ?? null,
          provideServiceValue ?? null,
          serviceType ?? null,
          image?.length ? imageUrls : null,
          image?.length ? publicIds : null,
          listingId,
          vendorId,
        ],
      );

      await client.query("COMMIT");
      return result.rows[0];
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
        "SELECT public_id FROM drone_listings WHERE id = $1 AND vendor_id = $2",
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
              await deleteFile(element);
            }),
          );
        } catch {
          await client.query("ROLLBACK");
          return { error: "Failed to delete drone image", success: false };
        }
      }

      await pool.query(
        `DELETE FROM drone_listings WHERE id = $1 AND vendor_id = $2`,
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
      "SELECT COUNT(*) AS total, COUNT(*) FILTER(WHERE status='active') AS active FROM drone_listings WHERE vendor_id=$1",
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
         SELECT dl.id, dl.listing_name, dl.manufacturer, dl.model, dl.category, dl.listing_type, dl.location, dl.quantity, dl.unit, dl.description, dl.sale_price, dl.condition, dl.warranty, dl.rental_price, dl.rental_period, dl.max_payload, dl.operating_range, dl.camera_type, dl.flight_time, dl.provide_service, dl.service_type, dl.image, dl.status, dl.created_at, dl.updated_at, cu.country_code, cu.currency
         FROM drone_listings dl
         LEFT JOIN country_utils cu ON dl.vendor_id = cu.vendor_id
         WHERE dl.status = 'active'
         ORDER BY dl.created_at DESC
         LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    const total = await pool.query(
      `
         SELECT COUNT(*) AS count
         FROM drone_listings
         WHERE status = 'active'
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
         SELECT dl.*, cu.country_code, cu.currency
         FROM drone_listings dl
         LEFT JOIN country_utils cu ON dl.vendor_id = cu.vendor_id
         WHERE dl.id = $1 AND dl.status = 'active'
      `,
      [listingId],
    );

    return result.rows[0] || null;
  },
};
