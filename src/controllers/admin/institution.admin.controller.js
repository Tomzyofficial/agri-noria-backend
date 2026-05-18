import { getInstitutionAnalytics, getInstitutionTransactions } from "../../db/admin/admin.db.js";
import { getPendingInputRequests, approveAndAssignInputRequest, getAllDistributors, approveInputFunds } from "../../db/pipeline/pipeline.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const institutionAdminController = {};

// Get analytics for institution dashboard
institutionAdminController.getAnalytics = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // Check if user is an institution or admin
      const role = payload.account_type?.toLowerCase();
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin"];
      
      if (!allowedRoles.includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Institutional access required" });
      }

      const analytics = await getInstitutionAnalytics();
      return res.status(200).json({ success: true, data: analytics });
   } catch (error) {
      console.error("Error fetching institution analytics:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch institution analytics" });
   }
};

// Get recent transactions for institution dashboard (Finance Only)
institutionAdminController.getTransactions = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const role = payload.account_type?.toLowerCase();
      // Strictly restrict transactions/approvals to Finance or Super Admin
      const allowedRoles = ["finance", "super admin", "admin"];
      
      if (!allowedRoles.includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Finance role required for approval data" });
      }

      const transactions = await getInstitutionTransactions(50);
      return res.status(200).json({ success: true, data: transactions });
   } catch (error) {
      console.error("Error fetching institution transactions:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch transactions" });
   }
};

// Get all pending input requests for approval queue
institutionAdminController.getPendingRequests = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || payload.account_type?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const requests = await getPendingInputRequests();
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching pending requests:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch pending requests" });
   }
};

// Get all distributors for assignment dropdown
institutionAdminController.getDistributors = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || payload.account_type?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const distributors = await getAllDistributors();
      return res.status(200).json({ success: true, data: distributors });
   } catch (error) {
      console.error("Error fetching distributors:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch distributors" });
   }
};

// Approve and assign a distributor to a request
institutionAdminController.assignDistributor = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || payload.account_type?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const { requestId, distributorId } = req.body;
      if (!requestId || !distributorId) {
         return res.status(400).json({ success: false, error: "Request ID and Distributor ID are required" });
      }

      const updatedRequest = await approveAndAssignInputRequest(requestId, payload.id, distributorId);
      return res.status(200).json({ success: true, data: updatedRequest });
   } catch (error) {
      console.error("Error assigning distributor:", error);
      return res.status(500).json({ success: false, error: "Failed to assign distributor" });
   }
};

// Approve funds (Stage 1) — locks funds in requester's wallet
institutionAdminController.approveFunds = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || payload.account_type?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const { requestId } = req.body;
      if (!requestId) {
         return res.status(400).json({ success: false, error: "Request ID is required" });
      }

      const updatedRequest = await approveInputFunds(requestId, payload.id);
      return res.status(200).json({ success: true, data: updatedRequest });
   } catch (error) {
      console.error("Error approving funds:", error);
      return res.status(500).json({ success: false, error: "Failed to approve funds" });
   }
};

export default institutionAdminController;
