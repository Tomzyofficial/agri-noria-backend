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
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin", "producer association", "cooperative", "research institution"];
      
      if (!allowedRoles.includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Institutional access required" });
      }

      const analytics = await getInstitutionAnalytics(payload.id, role);
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
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin", "producer association", "cooperative", "research institution"];
      
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
      const allowedRoles = ["institution", "government", "bank", "ngo", "dfi", "insurance firm", "commodity board", "finance", "super admin", "admin", "producer association", "cooperative", "research institution"];
      
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

// Approve funds (Stage 1) — Moves funds from Programme Wallet to Escrow Wallet
institutionAdminController.approveFunds = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload || (payload.role?.toLowerCase() !== 'finance' && payload.role?.toLowerCase() !== 'super admin' && payload.role?.toLowerCase() !== 'admin')) {
         return res.status(403).json({ success: false, error: "Finance role required" });
      }

      const { requestId } = req.body;
      if (!requestId) return res.status(400).json({ success: false, error: "Request ID is required" });

      // 1) FETCH REQUEST FIRST without modifying database status
      const { rows: reqRows } = await pool.query("SELECT * FROM input_requests WHERE id = $1", [requestId]);
      const requestData = reqRows[0];
      if (!requestData) {
         return res.status(404).json({ success: false, error: "Input request not found" });
      }
      if (requestData.funds_status === 'approved') {
         return res.status(400).json({ success: false, error: "Funds already authorized for this request" });
      }

      // 2) GET PROGRAM ID from package, farmer profile, or cluster
      let programId = null;
      if (requestData.package_id) {
         const { rows: packageRows } = await pool.query("SELECT program_id FROM input_packages WHERE id = $1", [requestData.package_id]);
         programId = packageRows[0]?.program_id;
      }
      if (!programId && requestData.farmer_id) {
         const { rows: farmerRows } = await pool.query("SELECT program_id FROM farmer_profiles WHERE id = $1", [requestData.farmer_id]);
         programId = farmerRows[0]?.program_id;
      }
      if (!programId && requestData.cluster_id) {
         const { rows: clusterRows } = await pool.query("SELECT program_id FROM clusters WHERE id = $1", [requestData.cluster_id]);
         programId = clusterRows[0]?.program_id;
      }

      if (!programId) return res.status(400).json({ success: false, error: "Invalid programme association. Requester must be enrolled in an active programme." });

      // 3) CHECK PROGRAM WALLET BALANCE BEFORE ANY MUTATION
      const { createProgramWallet, deductProgramWallet, createEscrowWallet } = await import("../../db/escrow/program_escrow.db.js");
      let programWallet = await createProgramWallet(programId, payload.id);
      
      if (parseFloat(programWallet.balance) < parseFloat(requestData.total_value)) {
         // Log depletion alert for the program sponsor
         const { rows: progRows } = await pool.query("SELECT created_by, name FROM programs WHERE id = $1", [programId]);
         if (progRows[0]?.created_by) {
             const alertMsg = `Input request approval of NGN ${parseFloat(requestData.total_value).toLocaleString()} for programme '${progRows[0].name}' failed due to depleted programme funds. Current Balance: NGN ${parseFloat(programWallet.balance).toLocaleString()}. Please fund your programme immediately.`;
             await pool.query(
                 "INSERT INTO program_notifications (program_id, recipient_id, title, message) VALUES ($1, $2, $3, $4)",
                 [programId, progRows[0].created_by, "Programme Funds Depleted", alertMsg]
             );
         }
         // Abort BEFORE approving the request or crediting any locked balance
         return res.status(400).json({ success: false, error: "Insufficient programme funds! An alert notification has been dispatched to the programme sponsor to replenish their funds." });
      }

      // 4) PROGRAM FUNDS ARE SUFFICIENT -> NOW EXECUTE APPROVAL & TRANSFER
      const updatedRequest = await approveInputFunds(requestId, payload.id);
      await deductProgramWallet(programWallet.id, parseFloat(updatedRequest.total_value));

      let heldForId = updatedRequest.is_cluster_request ? updatedRequest.cluster_id : updatedRequest.farmer_id;
      const heldForType = updatedRequest.is_cluster_request ? 'cluster' : 'farmer';
      if (!updatedRequest.is_cluster_request && updatedRequest.farmer_id) {
          const { rows: fRows } = await pool.query("SELECT vendor_id FROM farmer_profiles WHERE id = $1", [updatedRequest.farmer_id]);
          if (fRows[0]?.vendor_id) heldForId = fRows[0].vendor_id;
      }
      
      await createEscrowWallet(programId, heldForId, heldForType, parseFloat(updatedRequest.total_value), { "items_delivered": false }, updatedRequest.id, "input_request");

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

      const { getEscrowByReference, releaseEscrowWallet } = await import("../../db/escrow/program_escrow.db.js");
      const escrow = await getEscrowByReference(updatedRequest.id, "input_request");
      
      if (escrow) {
          await releaseEscrowWallet(escrow.id);
          let supplierWallet = await getWalletByOwner(updatedRequest.distributor_id, "supplier");
          if (!supplierWallet) {
              supplierWallet = await createWallet(updatedRequest.distributor_id, "supplier");
              if (!supplierWallet) supplierWallet = await getWalletByOwner(updatedRequest.distributor_id, "supplier");
          }
          if (supplierWallet) {
              const client = await pool.connect();
              try {
                  await client.query("BEGIN");
                  await client.query("UPDATE wallets SET balance = balance + $1, updated_at = now() WHERE id = $2", [escrow.amount, supplierWallet.id]);
                  await client.query("INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, reference_type, status) VALUES ($1, 'credit', $2, 'Payout for delivered inputs', $3, 'input_request', 'completed')", [supplierWallet.id, escrow.amount, updatedRequest.id]);
                  await client.query("COMMIT");
              } catch(e) {
                  await client.query("ROLLBACK");
              } finally {
                  client.release();
              }
          }
      }

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

// Cooperatives Directory endpoint
institutionAdminController.getCooperatives = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(
         `SELECT id, fname, lname, email, phone, company_name, created_at 
          FROM vendors 
          WHERE LOWER(role) LIKE '%coop%' 
          ORDER BY created_at DESC`
      );

      return res.status(200).json({ 
          success: true, 
          data: rows,
          total: rows.length 
      });
   } catch (error) {
      console.error("Error fetching cooperatives:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch cooperatives directory" });
   }
};

// Trial Plots endpoints
institutionAdminController.getTrialPlots = createDynamicController('getInstitutionTrialPlots');
institutionAdminController.createTrialPlot = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const newPlot = await dbModule.createInstitutionTrialPlot(payload.id, req.body);
      
      return res.status(201).json({ success: true, data: newPlot });
   } catch (error) {
      console.error("Error creating trial plot:", error);
      return res.status(500).json({ success: false, error: "Failed to create trial plot" });
   }
};

// Ecosystem Wallets Directory & Treasury Funding
institutionAdminController.getEcosystemWallets = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(
         `SELECT 
            v.id as vendor_id, 
            COALESCE(NULLIF(TRIM(CONCAT(v.fname, ' ', v.lname)), ''), v.company_name, 'Vendor') as name,
            v.fname,
            v.lname,
            v.email, 
            v.role, 
            v.company_name,
            COALESCE(w.balance, 0) as balance,
            COALESCE(w.locked_balance, 0) as locked_balance,
            COALESCE(w.currency, 'NGN') as currency
          FROM vendors v
          LEFT JOIN wallets w ON v.id = w.owner_id
          ORDER BY v.fname ASC, v.lname ASC`
      );

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching ecosystem wallets:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch ecosystem wallets" });
   }
};

institutionAdminController.creditUserWallet = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { vendor_id, amount, note } = req.body;
      const creditAmount = parseFloat(amount);

      if (!vendor_id || isNaN(creditAmount) || creditAmount <= 0) {
         return res.status(400).json({ success: false, error: "Valid vendor ID and credit amount are required" });
      }

      const client = await pool.connect();
      try {
         await client.query("BEGIN");

         // 1. Check or create vendor wallet
         let { rows: walletRows } = await client.query("SELECT * FROM wallets WHERE owner_id = $1", [vendor_id]);
         if (walletRows.length === 0) {
            const { rows: newW } = await client.query(
               "INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, status) VALUES ($1, 'user', 0, 0, 'active') RETURNING *",
               [vendor_id]
            );
            walletRows = newW;
         }

         // 2. Deduct from platform ecosystem treasury if available
         const { rows: platformRows } = await client.query("SELECT * FROM platform_wallets LIMIT 1");
         if (platformRows.length > 0) {
            await client.query("UPDATE platform_wallets SET ecosystem_treasury = ecosystem_treasury - $1 WHERE id = $2", [creditAmount, platformRows[0].id]);
         }

         // 3. Credit vendor wallet balance
         const { rows: updatedW } = await client.query(
            "UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE owner_id = $2 RETURNING *",
            [creditAmount, vendor_id]
         );

         // 4. Record transaction entry
         const description = note || `Ecosystem Treasury Funding (${payload.role || 'Finance'})`;
         await client.query(
            `INSERT INTO transactions (sender_id, recipient_id, amount, type, description, status)
             VALUES ($1, $2, $3, 'credit', $4, 'completed')`,
            [payload.id, vendor_id, creditAmount, description]
         );

         await client.query("COMMIT");

         return res.status(200).json({
            success: true,
            message: "Wallet credited successfully from Ecosystem Treasury",
            data: updatedW[0]
         });
      } catch (e) {
         await client.query("ROLLBACK");
         throw e;
      } finally {
         client.release();
      }
   } catch (error) {
      console.error("Error crediting user wallet:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to credit user wallet" });
   }
};

export default institutionAdminController;
