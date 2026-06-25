import pool from "../../lib/connect.js";

export async function getAnalyticsCount(vendorId) {
  try {
    const listingTotalQuery =
      "SELECT COUNT(*) AS totalListings FROM farm_dev_service_listings WHERE vendor_id = $1";

    const viewsQuery = `SELECT COALESCE(SUM(views_count), 0) AS totalViews
       FROM farm_dev_service_listings
       WHERE vendor_id = $1`;

    const inqueriesQuery = `SELECT COALESCE(SUM(inquiries_count), 0) AS totalInquiries
       FROM farm_dev_service_listings
       WHERE vendor_id = $1`;

    const [listingTotalResult, viewsResult, inqueriesResult] =
      await Promise.all([
        pool.query(listingTotalQuery, [vendorId]),
        pool.query(viewsQuery, [vendorId]),
        pool.query(inqueriesQuery, [vendorId]),
      ]);

    return {
      totalListings: parseInt(listingTotalResult.rows[0].totallistings) || 0,
      totalViews: parseInt(viewsResult.rows[0].totalviews) || 0,
      totalInquiries: parseInt(inqueriesResult.rows[0].totalinquiries) || 0,
    };
  } catch (error) {
    console.error("Database error in getListingsTotal:", error);
    return 0;
  }
}

export async function getLeadsCount(vendorId) {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM leads WHERE company_id = $1",
      [parseInt(vendorId)],
    );
    return parseInt(rows[0].count) || 0;
  } catch (error) {
    console.error("Database error in getLeadsCount:", error);
    return 0;
  }
}

export async function getTotalViews(vendorId) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(views_count), 0) as total
       FROM farm_dev_service_listings
       WHERE vendor_id = $1`,
      [vendorId],
    );
    return parseInt(rows[0].total) || 0;
  } catch (error) {
    console.error("Database error in getTotalViews:", error);
    return 0;
  }
}

export async function getLeadsByStatus(vendorId) {
  try {
    const { rows } = await pool.query(
      "SELECT status, COUNT(*) as count FROM leads WHERE company_id = $1 GROUP BY status",
      [parseInt(vendorId)],
    );
    return rows.map((r) => ({ status: r.status, count: parseInt(r.count) }));
  } catch (error) {
    console.error("Database error in getLeadsByStatus:", error);
    return [];
  }
}

export async function getTopListings(vendorId, limit = 5) {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, views_count FROM farm_dev_service_listings 
       WHERE vendor_id = $1
       ORDER BY views_count DESC
       LIMIT $2`,
      [vendorId, limit],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getTopListings:", error);
    return [];
  }
}
