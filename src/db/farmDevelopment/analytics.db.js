import pool from "../../lib/connect.js";

export async function getListingsCount(companyId) {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM service_listings WHERE company_id = $1",
      [parseInt(companyId)],
    );
    return parseInt(rows[0].count) || 0;
  } catch (error) {
    console.error("Database error in getListingsCount:", error);
    return 0;
  }
}

export async function getLeadsCount(companyId) {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM leads WHERE company_id = $1",
      [parseInt(companyId)],
    );
    return parseInt(rows[0].count) || 0;
  } catch (error) {
    console.error("Database error in getLeadsCount:", error);
    return 0;
  }
}

export async function getTotalViews(companyId) {
  try {
    const { rows } = await pool.query(
      `SELECT SUM(lv.views_count) as total
       FROM listing_views lv
       JOIN service_listings sl ON lv.listing_id = sl.id
       WHERE sl.company_id = $1`,
      [parseInt(companyId)],
    );
    return parseInt(rows[0].total) || 0;
  } catch (error) {
    console.error("Database error in getTotalViews:", error);
    return 0;
  }
}

export async function getLeadsByStatus(companyId) {
  try {
    const { rows } = await pool.query(
      "SELECT status, COUNT(*) as count FROM leads WHERE company_id = $1 GROUP BY status",
      [parseInt(companyId)],
    );
    return rows.map((r) => ({ status: r.status, count: parseInt(r.count) }));
  } catch (error) {
    console.error("Database error in getLeadsByStatus:", error);
    return [];
  }
}

export async function getTopListings(companyId, limit = 5) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, views_count FROM service_listings 
       WHERE company_id = $1
       ORDER BY views_count DESC
       LIMIT $2`,
      [parseInt(companyId), limit],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getTopListings:", error);
    return [];
  }
}
