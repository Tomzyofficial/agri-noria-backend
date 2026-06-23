import {
  getLeadsCount,
  getTotalViews,
  getLeadsByStatus,
  getTopListings,
  getAnalyticsCount,
} from "../../db/farmDevelopment/analytics.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const analyticsController = {};

analyticsController.getAnalyticsCount = async (req, res) => {
  try {
    const payload = await verifyVendorToken(req);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const analytics = await getAnalyticsCount(payload.id);

    return res.status(200).json({
      success: true,
      data: {
        totalListings: analytics.totalListings,
        totalViews: analytics.totalViews,
        totalInquiries: analytics.totalInquiries,
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
