import pool from "../../lib/connect.js";
import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";

export async function uploadTrainingMaterial(
  vendor_id,
  title,
  description,
  filePath,
  fileType,
  file_size,
  category,
) {
  const query = `
      INSERT INTO training_materials (vendor_id, title, description, file_path, file_type, file_size, created_at, category)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *;
   `;

  const values = [
    vendor_id,
    title,
    description,
    filePath,
    fileType,
    file_size,
    category,
  ];
  try {
    const result = await pool.query(query, values);
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error("Error saving material to database:", error);
    return {
      success: false,
      error: "Failed to save material. Please try again.",
    };
  }
}

// Delete training material by training partner
export async function deleteMaterial(materialId, vendorId) {
  const client = await pool.connect();
  await client.query("BEGIN");

  try {
    // Fetch the material to get its file path
    const { rows } = await client.query(
      "SELECT file_path FROM training_materials WHERE id = $1 AND vendor_id = $2",
      [materialId, vendorId],
    );

    if (rows.length === 0) {
      return { success: false, error: "Material not found or unauthorized" };
    }

    const { file_path: filePath } = rows[0];

    // Delete the file from Cloudinary if it exists
    if (filePath && filePath.includes("cloudinary.com")) {
      const deleteResult = await deleteFileFromCloudinary(filePath);
      if (!deleteResult || deleteResult.result !== "ok") {
        return {
          success: false,
          error: "Failed to delete file from Cloud",
        };
      }
    }

    // Delete the material from the database
    const result = await client.query(
      "DELETE FROM training_materials WHERE id = $1 AND vendor_id = $2 RETURNING *",
      [materialId, vendorId],
    );

    await client.query("COMMIT");
    return { success: true, data: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting material:", error);
    return {
      success: false,
      error: "Failed to delete material. Please try again.",
    };
  } finally {
    client.release();
  }
}

// Get upload training materials for a vendor
export async function getMaterialsByVendor(vendor_id) {
  const query = `
      SELECT id, title, description, file_path, file_type, file_size, created_at
      FROM training_materials WHERE vendor_id = $1
   `;

  try {
    const result = await pool.query(query, [vendor_id]);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error("Error fetching materials from database:", error);
    return {
      success: false,
      error: "Failed to fetch materials. Please try again.",
    };
  }
}

// Get training material public use
export async function getUploadedMaterials() {
  const query = `SELECT t.id, t.vendor_id, t.title, t.description, t.file_path, t.file_size, 
      t.file_type, t.category, v.fname, v.lname FROM training_materials AS t LEFT JOIN vendors v ON v.id = t.vendor_id`;
  const result = await pool.query(query);
  return result.rows;
}
