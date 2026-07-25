import pool from "../../lib/connect.js";
import {
  deleteFileFromCloudinary,
  saveFileToCloudinary,
} from "../../lib/cloudinary.img.js";

// Create listings
export async function createListingWithDetails(
  account_id,
  role,
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

    //  let product_img = null;
    //  if (product_image) {
    //    product_img = await saveFileToCloudinary(
    //      product_image,
    //      "marketplace",
    //      "image",
    //    );
    //  }

    // Insert into unified listings table ONLY
    const listingResult = await client.query(
      `INSERT INTO listings (account_id, role, listing_name, description, price, location, unit_measure, available_quantity, discount, unit, category, min_quantity, attributes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id`,
      [
        account_id,
        role,
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

    if (product_image) {
      const saveImageToCloud = await saveFileToCloudinary(
        product_image,
        "marketplace",
        "image",
      );
      const imageUrl = saveImageToCloud?.map((img) => img.secure_url);
      const publicId = saveImageToCloud?.map((img) => img.public_id);

      await client.query(
        `UPDATE listings SET product_image = $1, public_id = $2 WHERE id = $3`,
        [imageUrl, publicId, listingResult.rows[0].id],
      );
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
export async function fetchListedItems(account_id) {
  const result = await pool.query(
    `SELECT ls.id, ls.account_id, ls.product_image, ls.listing_name, ls.description, ls.price, ls.product_status, cu.country_code, cu.currency FROM listings ls JOIN country_utils cu ON ls.account_id = cu.vendor_id WHERE ls.account_id = $1 ORDER BY ls.id DESC`,
    [account_id],
  );
  return result.rows;
}

export const getTotalProducts = async (userId) => {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(id) AS total FROM listings WHERE product_status = 'active' AND account_id = $1",
      [userId],
    );

    return rows[0].total;
  } catch {
    return { total: 0 };
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
      "SELECT id, product_image FROM listings WHERE id = $1 AND account_id = $2 AND product_status = $3",
      [id, account_id, "active"],
    );

    if (existingListing.rows.length === 0) {
      return { success: false, error: "Product not found or not authorized" };
    }

    const current = existingListing.rows[0];

    let newProductImg = null;
    if (product_image) {
      await deleteFileFromCloudinary(current.product_image);
      newProductImg = await saveFileToCloudinary(
        product_image,
        "marketplace",
        "image",
      );
    }

    // Update unified listings table with all fields
    const result = await client.query(
      `UPDATE listings SET 
             product_image = COALESCE($1, product_image),
             listing_name = COALESCE($2, listing_name),
             description = COALESCE($3, description),
             price = COALESCE($4, price),
             location = COALESCE($5, location),
             unit_measure = COALESCE($6, unit_measure),
             available_quantity = COALESCE($7, available_quantity),
             unit = COALESCE($8, unit),
             min_quantity = COALESCE($9, min_quantity),
             category = COALESCE($10, category),
             discount = COALESCE($11, discount),
             attributes = COALESCE($12, attributes),
             updated_at = NOW()
          WHERE id = $13 
          AND account_id = $14 
          AND product_status = $15 
          RETURNING id, product_image, listing_name, description, price, location, unit_measure, available_quantity, unit, min_quantity, category, discount, attributes`,
      [
        newProductImg?.secure_url,
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
export async function deleteProduct(productId, payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if product exist and belongs to the vendor
    const productCheck = await client.query(
      "SELECT id, product_image FROM listings WHERE id = $1 AND account_id = $2",
      [productId, payload.id],
    );

    if (productCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        error: "Product not found or not authorized",
        success: false,
      };
    }

    const product = productCheck.rows[0];
    const imageUrl = product.product_image;

    if (imageUrl && imageUrl.includes("cloudinary.com")) {
      try {
        const deleteResult = await deleteFileFromCloudinary(imageUrl);
        if (deleteResult.result !== "ok") {
          await client.query("ROLLBACK");
          return {
            error: deleteResult.messsage || "Failed to delete product image",
            success: false,
          };
        }
      } catch {
        await client.query("ROLLBACK");
        return { error: "Failed to delete product image", success: false };
      }
    }

    const deleteProduct = await client.query(
      "DELETE FROM listings WHERE id = $1 AND account_id = $2",
      [productId, payload.id],
    );

    if (deleteProduct.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Failed to delete product" };
    }

    await client.query("COMMIT");

    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    return { error: error, success: false };
  } finally {
    client.release();
  }
}
