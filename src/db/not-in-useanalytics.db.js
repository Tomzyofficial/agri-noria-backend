import { verifyVendorToken } from "../sessions/vendor.auth.session";
import pool from "../lib/connect";

export async function getAnalytics(companyId) {
  try {
    // Get total listings
    const listings = await queryOne(
      "SELECT COUNT(*) as count FROM service_listings WHERE company_id = $1",
      [companyId],
    );

    // Get total leads
    const leads = await pool.query(
      "SELECT COUNT(*) as count FROM leads WHERE company_id = $1",
      [companyId],
    );

    // Get total views
    const views = await queryOne(
      `SELECT SUM(lv.views_count) as total
       FROM listing_views lv
       JOIN service_listings sl ON lv.listing_id = sl.id
       WHERE sl.company_id = $1`,
      [companyId],
    );

    // Get leads by status
    const leadsByStatus = await queryMany(
      "SELECT status, COUNT(*) as count FROM leads WHERE company_id = $1 GROUP BY status",
      [companyId],
    );

    // Get top performing listings
    const topListings = await pool.query(
      `SELECT id, title, views_count FROM service_listings 
       WHERE company_id = $1
       ORDER BY views_count DESC
       LIMIT 5`,
      [companyId],
    );

    return {
      success: true,
      totalListings: parseInt(listings.count),
      totalLeads: parseInt(leads.count),
      totalViews: parseInt(views.total || 0),
      leadsByStatus: leadsByStatus.map((r) => ({
        status: r.status,
        count: parseInt(r.count),
      })),
      topListings,
    };
  } catch (error) {
    console.error("[v0] Analytics GET error:", error);
    return { success: false, error: "Failed to fetch analytics" };
  }
}
