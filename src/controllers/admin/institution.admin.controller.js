import { getInstitutionAnalytics, getInstitutionTransactions } from "../../db/admin/admin.db.js";
import { getPendingInputRequests, approveAndAssignInputRequest, getAllDistributors, approveInputFunds, getWalletByOwner, createWallet, depositLockedFunds, payoutDistributor } from "../../db/pipeline/pipeline.db.js";
import pool from "../../lib/connect.js";
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
      const role = payload.role?.toLowerCase();
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

// Get portfolio metrics for institution dashboard
institutionAdminController.getPortfolio = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const role = payload.role?.toLowerCase();
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin"];
      
      if (!allowedRoles.includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Institutional access required" });
      }

      // Import inside or use existing if it's already at top level
      const { getInstitutionPortfolio } = await import("../../db/admin/admin.db.js");
      const portfolio = await getInstitutionPortfolio();
      return res.status(200).json({ success: true, data: portfolio });
   } catch (error) {
      console.error("Error fetching institution portfolio:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch institution portfolio" });
   }
};

// Get impact metrics for institution dashboard
institutionAdminController.getImpact = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const role = payload.role?.toLowerCase();
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin"];
      
      if (!allowedRoles.includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Institutional access required" });
      }

      const { getInstitutionImpact } = await import("../../db/admin/admin.db.js");
      const impact = await getInstitutionImpact();
      return res.status(200).json({ success: true, data: impact });
   } catch (error) {
      console.error("Error fetching institution impact:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch institution impact" });
   }
};

// Update institution profile
institutionAdminController.updateProfile = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      // We can reuse aggregatorDb.updateProfile since it just updates the vendors table
      const aggregatorDb = (await import("../../db/aggregator/aggregator.db.js")).default;
      const updatedProfile = await aggregatorDb.updateProfile(payload.id, req.body);
      
      return res.status(200).json({ success: true, data: updatedProfile });
   } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ success: false, error: "Failed to update profile" });
   }
};

// Get recent transactions for institution dashboard (Finance Only)
institutionAdminController.getTransactions = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const role = payload.role?.toLowerCase();
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
      if (!payload || payload.role?.toLowerCase() !== 'finance') {
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
      if (!payload || payload.role?.toLowerCase() !== 'finance') {
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
      if (!payload || payload.role?.toLowerCase() !== 'finance') {
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
      if (!payload || payload.role?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const { requestId } = req.body;
      if (!requestId) {
         return res.status(400).json({ success: false, error: "Request ID is required" });
      }

      const updatedRequest = await approveInputFunds(requestId, payload.id);

      // ENSURE FUNDS ARE NOT WITHDRAWABLE (DEPOSIT TO LOCKED BALANCE)
      if (updatedRequest.is_cluster_request) {
         let clusterWallet = await getWalletByOwner(updatedRequest.cluster_id, "cluster");
         if (!clusterWallet) {
             clusterWallet = await createWallet(updatedRequest.cluster_id, "cluster");
             if (!clusterWallet) clusterWallet = await getWalletByOwner(updatedRequest.cluster_id, "cluster");
         }
         if (clusterWallet) {
            await depositLockedFunds(clusterWallet.id, parseFloat(updatedRequest.total_value), "Input financing approved", updatedRequest.id, "input_request");
         }
      } else {
         const { rows } = await pool.query("SELECT vendor_id FROM farmer_profiles WHERE id = $1", [updatedRequest.farmer_id]);
         if (rows.length > 0) {
            let farmerWallet = await getWalletByOwner(rows[0].vendor_id, "farmer");
            if (!farmerWallet) {
                farmerWallet = await createWallet(rows[0].vendor_id, "farmer");
                if (!farmerWallet) farmerWallet = await getWalletByOwner(rows[0].vendor_id, "farmer");
            }
            if (farmerWallet) {
               await depositLockedFunds(farmerWallet.id, parseFloat(updatedRequest.total_value), "Input financing approved", updatedRequest.id, "input_request");
            }
         }
      }

      return res.status(200).json({ success: true, data: updatedRequest });
   } catch (error) {
      console.error("Error approving funds:", error);
      return res.status(500).json({ success: false, error: "Failed to approve funds" });
   }
};

// Payout distributor for delivered inputs
institutionAdminController.payoutDistributor = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || payload.role?.toLowerCase() !== 'finance') {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const { requestId } = req.body;
      if (!requestId) return res.status(400).json({ success: false, error: "Request ID required" });

      const updatedRequest = await payoutDistributor(requestId, payload.id);
      return res.status(200).json({ success: true, data: updatedRequest });
   } catch (error) {
      console.error("Error paying out distributor:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to payout distributor" });
   }
};
// Dynamic Pages Endpoints
const createDynamicController = (dbMethodName) => async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const data = await dbModule[dbMethodName](payload.id, payload.role);

      return res.status(200).json({ success: true, data });
   } catch (error) {
      console.error(`Error in ${dbMethodName}:`, error);
      return res.status(500).json({ success: false, error: "Server Error" });
   }
};

institutionAdminController.getMonitoring = createDynamicController('getInstitutionMonitoring');
institutionAdminController.getEscrow = createDynamicController('getInstitutionEscrow');
institutionAdminController.getProcurement = createDynamicController('getInstitutionProcurement');
institutionAdminController.getTraceability = createDynamicController('getInstitutionTraceability');
institutionAdminController.getReports = createDynamicController('getInstitutionReports');
institutionAdminController.getExtension = createDynamicController('getInstitutionExtension');
institutionAdminController.getNgoDistribution = createDynamicController('getInstitutionNgoDistribution');

export default institutionAdminController;
