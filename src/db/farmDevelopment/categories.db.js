import pool from "../../lib/connect.js";

export async function getCategories() {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, description, icon_name FROM service_categories ORDER BY name",
    );
    return rows;
  } catch (error) {
    console.error("Database error in getCategories:", error);
    return null;
  }
}
