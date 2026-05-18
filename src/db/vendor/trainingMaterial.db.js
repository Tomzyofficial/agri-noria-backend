import pool from "../../lib/connect.js";
import { deleteFileFromCloudinary } from "../../lib/cloudinary.img.js";

export async function saveMaterial(vendor_id, title, description, filePath, fileType, file_size) {
   const query = `
      INSERT INTO training_materials (vendor_id, title, description, file_path, file_type, file_size, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *;
   `;

   const values = [vendor_id, title, description, filePath, fileType, file_size];
   try {
      const result = await pool.query(query, values);
      return { success: true, data: result.rows[0] };
   } catch (error) {
      console.error("Error saving material to database:", error);
      return { success: false, error: "Failed to save material. Please try again." };
   }
}

// Delete training material by training partner
export async function deleteMaterial(materialId, vendorId) {
   const client = await pool.connect();
   await client.query("BEGIN");

   try {
      // Fetch the material to get its file path
      const { rows } = await client.query("SELECT file_path FROM training_materials WHERE id = $1 AND vendor_id = $2", [
         materialId,
         vendorId,
      ]);

      if (rows.length === 0) {
         return { success: false, error: "Material not found or unauthorized" };
      }

      const { file_path: filePath } = rows[0];

      // Delete the file from Cloudinary if it exists
      if (filePath && filePath.includes("cloudinary.com")) {
         const deleteResult = await deleteFileFromCloudinary(filePath);
         if (!deleteResult || deleteResult.result !== "ok") {
            return { success: false, error: "Failed to delete file from Cloudinary" };
         }
      }

      // Delete the material from the database
      const result = await client.query("DELETE FROM training_materials WHERE id = $1 AND vendor_id = $2 RETURNING *", [
         materialId,
         vendorId,
      ]);

      await client.query("COMMIT");
      return { success: true, data: result.rows[0] };
   } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error deleting material:", error);
      return { success: false, error: "Failed to delete material. Please try again." };
   } finally {
      client.release();
   }
}

// Get upload training materials for a vendor
export async function getMaterialsByVendor(vendor_id) {
   const query = `
      SELECT id, title, description, file_path, file_type, file_size, is_active, created_at
      FROM training_materials
      WHERE vendor_id = $1
   `;

   try {
      const result = await pool.query(query, [vendor_id]);
      return { success: true, data: result.rows };
   } catch (error) {
      console.error("Error fetching materials from database:", error);
      return { success: false, error: "Failed to fetch materials. Please try again." };
   }
}

// Get training material public use example farmer dashboard
export async function getUploadedMaterials() {
   const query = `
      SELECT * FROM training_materials
   `;
   const result = await pool.query(query);

   return result.rows;
}
