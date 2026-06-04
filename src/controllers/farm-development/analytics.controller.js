import {
  getListingsCount,
  getLeadsCount,
  getTotalViews,
  getLeadsByStatus,
  getTopListings,
} from "../../db/farm-development/analytics.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const analyticsController = {};

analyticsController.getAnalytics = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required",
      });
    }

    const [totalListings, totalLeads, totalViews, leadsByStatus, topListings] =
      await Promise.all([
        getListingsCount(companyId),
        getLeadsCount(companyId),
        getTotalViews(companyId),
        getLeadsByStatus(companyId),
        getTopListings(companyId),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        totalListings,
        totalLeads,
        totalViews,
        leadsByStatus,
        topListings,
      },
    });
  } catch (error) {
    console.error("Error in getAnalytics controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch analytics",
    });
  }
};

export default analyticsController;
