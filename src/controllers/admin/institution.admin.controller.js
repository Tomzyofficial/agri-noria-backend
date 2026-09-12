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
            COALESCE(MAX(w.balance), 0) as balance,
            COALESCE(MAX(w.locked_balance), 0) as locked_balance,
            COALESCE(MAX(w.currency), 'NGN') as currency
          FROM vendors v
          LEFT JOIN wallets w ON v.id = w.owner_id AND LOWER(w.owner_type) = LOWER(v.role)
          GROUP BY v.id
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

         // 1. Get vendor role to match correct wallet owner_type
         const { rows: vRows } = await client.query("SELECT role FROM vendors WHERE id = $1", [vendor_id]);
         const vendorRole = vRows.length > 0 ? (vRows[0].role || 'user').toLowerCase() : 'user';

         // 2. Check or create vendor's role-specific wallet
         let { rows: walletRows } = await client.query("SELECT * FROM wallets WHERE owner_id = $1 AND LOWER(owner_type) = $2", [vendor_id, vendorRole]);
         if (walletRows.length === 0) {
            const { rows: newW } = await client.query(
               "INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, status) VALUES ($1, $2, 0, 0, 'active') RETURNING *",
               [vendor_id, vendorRole]
            );
            walletRows = newW;
         }

         // 2. Deduct from platform ecosystem treasury (finance_wallets)
         const { rows: financeRows } = await client.query("SELECT * FROM finance_wallets WHERE finance_user_id = $1 LIMIT 1", [payload.id]);
         if (financeRows.length > 0) {
            await client.query("UPDATE finance_wallets SET balance = balance - $1 WHERE id = $2", [creditAmount, financeRows[0].id]);
         } else {
            // If the specific finance user doesn't have a wallet, just take from the first one or ignore
            const { rows: anyFinance } = await client.query("SELECT * FROM finance_wallets LIMIT 1");
            if (anyFinance.length > 0) {
               await client.query("UPDATE finance_wallets SET balance = balance - $1 WHERE id = $2", [creditAmount, anyFinance[0].id]);
            }
         }

         // 3. Credit vendor wallet balance
         const { rows: updatedW } = await client.query(
            "UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [creditAmount, walletRows[0].id]
         );

         // 4. Record transaction entry
         const description = note || `Ecosystem Treasury Funding (${payload.role || 'Finance'})`;
         await client.query(
            `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_type, status)
             VALUES ($1, 'credit', $2, $3, 'treasury_funding', 'completed')`,
            [walletRows[0].id, creditAmount, description]
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

// Organization Members (Cooperative / Producer Association)
institutionAdminController.getMembers = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const members = await dbModule.getOrganizationMembers(payload.id, payload.role);
      return res.status(200).json({ success: true, data: members });
   } catch (error) {
      console.error("Error fetching organization members:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch members" });
   }
};

institutionAdminController.importMember = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");

      // Check if payload is bulk array
      const farmerList = Array.isArray(req.body) ? req.body : req.body.farmers;
      if (Array.isArray(farmerList) && farmerList.length > 0) {
         let newCount = 0;
         let linkedCount = 0;
         const createdCredentials = [];
         const rowErrors = [];

         for (const farmerData of farmerList) {
            try {
               const resObj = await dbModule.importOrLinkFarmerToOrg(payload.id, farmerData);
               if (resObj.isNewFarmer) {
                  newCount++;
                  if (resObj.tempPassword) {
                     createdCredentials.push({
                        name: resObj.name,
                        email: resObj.email,
                        phone: resObj.phone,
                        tempPassword: resObj.tempPassword,
                        membership_number: farmerData.membership_number || null,
                        commodity: farmerData.commodity || null
                     });
                  }
               } else {
                  linkedCount++;
               }
            } catch (err) {
               console.warn("Error importing item in bulk:", err.message);
               rowErrors.push({
                  farmer: `${farmerData.fname || ''} ${farmerData.lname || ''}`.trim() || farmerData.phone || 'Unknown',
                  error: err.message
               });
            }
         }
         return res.status(200).json({
            success: true,
            message: `Bulk import completed: ${newCount} new farmers registered with temporary credentials, ${linkedCount} existing farmers linked to your organization.`,
            newCount,
            linkedCount,
            totalProcessed: farmerList.length,
            credentials: createdCredentials,
            errors: rowErrors.length > 0 ? rowErrors : undefined
         });
      }

      // Single import
      const result = await dbModule.importOrLinkFarmerToOrg(payload.id, req.body);
      return res.status(200).json(result);
   } catch (error) {
      console.error("Error importing farmer member:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to import farmer" });
   }
};

// Polymorphic Groups (Member Clusters, Producer Groups, Research Cohorts)
institutionAdminController.getGroups = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const groupType = req.query.group_type || null;
      const dbModule = await import("../../db/admin/admin.db.js");
      const groups = await dbModule.getOrganizationGroups(payload.id, groupType, payload.role);
      return res.status(200).json({ success: true, data: groups });
   } catch (error) {
      console.error("Error fetching groups:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch groups" });
   }
};

institutionAdminController.createGroup = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const newGroup = await dbModule.createOrganizationGroup(payload.id, req.body);
      return res.status(201).json({ success: true, data: newGroup });
   } catch (error) {
      console.error("Error creating group:", error);
      return res.status(500).json({ success: false, error: "Failed to create group" });
   }
};

institutionAdminController.assignGroupMember = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { groupId, farmerId, role, cohortLabel } = req.body;
      if (!groupId || !farmerId) {
         return res.status(400).json({ success: false, error: "Group ID and Farmer ID required" });
      }

      const dbModule = await import("../../db/admin/admin.db.js");
      const membership = await dbModule.assignFarmerToGroup(groupId, farmerId, role, cohortLabel);
      return res.status(200).json({ success: true, data: membership });
   } catch (error) {
      console.error("Error assigning group member:", error);
      return res.status(500).json({ success: false, error: "Failed to assign member to group" });
   }
};

// Producer Association Affiliations
institutionAdminController.getAffiliations = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const affiliations = await dbModule.getAffiliatedCooperatives(payload.id);
      return res.status(200).json({ success: true, data: affiliations });
   } catch (error) {
      console.error("Error fetching affiliations:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch affiliations" });
   }
};

institutionAdminController.affiliateCooperative = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { coopId, status } = req.body;
      if (!coopId) return res.status(400).json({ success: false, error: "Cooperative ID is required" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const result = await dbModule.affiliateCooperative(payload.id, coopId, status || 'active');
      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error updating affiliation:", error);
      return res.status(500).json({ success: false, error: "Failed to update affiliation" });
   }
};

// Research Projects & Cohorts
institutionAdminController.getResearchProjects = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const projects = await dbModule.getResearchProjects(payload.id, payload.role);
      return res.status(200).json({ success: true, data: projects });
   } catch (error) {
      console.error("Error fetching research projects:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch research projects" });
   }
};

institutionAdminController.createResearchProject = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const project = await dbModule.createResearchProject(payload.id, req.body);
      return res.status(201).json({ success: true, data: project });
   } catch (error) {
      console.error("Error creating research project:", error);
      return res.status(500).json({ success: false, error: "Failed to create research project" });
   }
};

institutionAdminController.requestProjectFunding = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { projectId, amount, notes } = req.body;
      if (!projectId || !amount) {
         return res.status(400).json({ success: false, error: "Project ID and Amount are required" });
      }

      const dbModule = await import("../../db/admin/admin.db.js");
      const updated = await dbModule.requestResearchProjectFunding(payload.id, projectId, amount, notes);
      return res.status(200).json({ success: true, data: updated, message: "Project grant funding requested successfully" });
   } catch (error) {
      console.error("Error requesting project funding:", error);
      return res.status(500).json({ success: false, error: "Failed to request funding" });
   }
};

institutionAdminController.getObservations = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ success: false, error: "Project ID required" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const observations = await dbModule.getResearchObservations(projectId);
      return res.status(200).json({ success: true, data: observations });
   } catch (error) {
      console.error("Error fetching observations:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch observations" });
   }
};

institutionAdminController.logObservation = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const dbModule = await import("../../db/admin/admin.db.js");
      const observation = await dbModule.logResearchObservation(payload.id, req.body);
      return res.status(201).json({ success: true, data: observation });
   } catch (error) {
      console.error("Error logging observation:", error);
      return res.status(500).json({ success: false, error: "Failed to log observation" });
   }
};

institutionAdminController.getEscrow = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(`
         SELECT 
            wt.id,
            wt.amount,
            wt.type,
            wt.description,
            wt.status,
            wt.created_at,
            p.name as program_name,
            COALESCE(pw.balance, 0) as program_wallet_balance
         FROM wallet_transactions wt
         LEFT JOIN wallets w ON wt.wallet_id = w.id
         LEFT JOIN programs p ON wt.reference_id = p.id::text OR wt.description ILIKE '%' || p.name || '%'
         LEFT JOIN program_wallets pw ON p.id = pw.program_id
         WHERE w.owner_id = $1 OR wt.reference_type IN ('program_funding', 'escrow', 'treasury_funding')
         ORDER BY wt.created_at DESC
         LIMIT 50
      `, [payload.id]);

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching escrow data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch escrow data" });
   }
};

institutionAdminController.getMonitoring = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows: clusters } = await pool.query(`
         SELECT c.id, c.name, c.region, c.target_hectares,
                COUNT(cm.id) as total_farmers,
                COALESCE(AVG(fp.farm_size_hectares), 0) as avg_farm_size
         FROM clusters c
         LEFT JOIN cluster_members cm ON c.id = cm.cluster_id
         LEFT JOIN farmer_profiles fp ON cm.farmer_id = fp.id
         GROUP BY c.id, c.name, c.region, c.target_hectares
         ORDER BY c.created_at DESC
      `);

      let alerts = [];
      try {
         const alertRes = await pool.query("SELECT * FROM risk_reports ORDER BY created_at DESC LIMIT 10");
         alerts = alertRes.rows;
      } catch (_) {}

      return res.status(200).json({ success: true, data: { clusters, alerts } });
   } catch (error) {
      console.error("Error fetching monitoring data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch monitoring data" });
   }
};

institutionAdminController.getProcurement = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(`
         SELECT ir.id, ir.total_value, ir.status, ir.funds_status, ir.items_status, ir.created_at,
                ip.name as package_name, ip.crop,
                v.fname || ' ' || v.lname as farmer_name,
                c.name as cluster_name
         FROM input_requests ir
         LEFT JOIN input_packages ip ON ir.package_id = ip.id
         LEFT JOIN farmer_profiles fp ON ir.farmer_id = fp.id
         LEFT JOIN vendors v ON fp.vendor_id = v.id
         LEFT JOIN clusters c ON ir.cluster_id = c.id
         ORDER BY ir.created_at DESC
         LIMIT 50
      `);

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching procurement data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch procurement data" });
   }
};

institutionAdminController.getTraceability = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(`
         SELECT hb.batch_id, hb.batch_number, hb.crop, hb.quantity_mt, hb.status as batch_status, hb.created_at,
                v.fname || ' ' || v.lname as farmer_name,
                lt.ticket_number as logistics_ticket, lt.status as logistics_status,
                st.ticket_number as storage_ticket, st.status as storage_status
         FROM harvest_batches hb
         LEFT JOIN vendors v ON hb.vendor_id = v.id
         LEFT JOIN logistics_tickets lt ON hb.batch_id = lt.batch_id
         LEFT JOIN storage_tickets st ON hb.batch_id = st.batch_id
         ORDER BY hb.created_at DESC
         LIMIT 50
      `);

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching traceability data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch traceability data" });
   }
};

institutionAdminController.getReports = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows: programs } = await pool.query(`
         SELECT p.id, p.name, p.crop, p.budget, p.target_farmers, p.status, p.created_at,
                COALESCE(pw.balance, 0) as wallet_balance
         FROM programs p
         LEFT JOIN program_wallets pw ON p.id = pw.program_id
         ORDER BY p.created_at DESC
      `);

      return res.status(200).json({ success: true, data: { programs } });
   } catch (error) {
      console.error("Error fetching reports:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch reports" });
   }
};

institutionAdminController.getExtension = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows: officers } = await pool.query(`
         SELECT v.id, v.fname, v.lname, v.email, v.phone, v.role, v.approval_status
         FROM vendors v
         WHERE v.role IN ('field officer', 'agronomist', 'inspector', 'extension worker')
         ORDER BY v.created_at DESC
      `);

      let schedules = [];
      try {
         const schedRes = await pool.query(`
            SELECT vs.*, v.fname || ' ' || v.lname as officer_name
            FROM visit_schedules vs
            LEFT JOIN vendors v ON vs.officer_id = v.id
            ORDER BY vs.scheduled_date DESC
            LIMIT 20
         `);
         schedules = schedRes.rows;
      } catch (_) {}

      return res.status(200).json({ success: true, data: { officers, schedules } });
   } catch (error) {
      console.error("Error fetching extension data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch extension data" });
   }
};

institutionAdminController.getNgoDistribution = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      let rows = [];
      try {
         const distRes = await pool.query(`
            SELECT id_dist.*, ir.total_value, ip.name as package_name,
                   v.fname || ' ' || v.lname as farmer_name
            FROM input_distributions id_dist
            LEFT JOIN input_requests ir ON id_dist.request_id = ir.id
            LEFT JOIN input_packages ip ON id_dist.package_id = ip.id
            LEFT JOIN farmer_profiles fp ON id_dist.farmer_id = fp.id
            LEFT JOIN vendors v ON fp.vendor_id = v.id
            ORDER BY id_dist.created_at DESC
            LIMIT 50
         `);
         rows = distRes.rows;
      } catch (_) {}

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching NGO distribution data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch distribution data" });
   }
};

institutionAdminController.getCooperatives = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { rows } = await pool.query(`
         SELECT id, company_name, fname, lname, email, phone, role
         FROM vendors
         WHERE role IN ('cooperative', 'producer association', 'aggregator')
         ORDER BY created_at DESC
      `);

      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching cooperatives:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch cooperatives" });
   }
};

institutionAdminController.getTrialPlots = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      await pool.query(`
         CREATE TABLE IF NOT EXISTS trial_plots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            institution_id UUID REFERENCES vendors(id),
            name VARCHAR(255) NOT NULL,
            crop VARCHAR(100) NOT NULL,
            hectares NUMERIC(10,2) DEFAULT 1,
            location VARCHAR(255),
            trial_objective TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
         )
      `);

      const { rows } = await pool.query(
         "SELECT * FROM trial_plots WHERE institution_id = $1 ORDER BY created_at DESC",
         [payload.id]
      );
      return res.status(200).json({ success: true, data: rows });
   } catch (error) {
      console.error("Error fetching trial plots:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch trial plots" });
   }
};

institutionAdminController.createTrialPlot = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      await pool.query(`
         CREATE TABLE IF NOT EXISTS trial_plots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            institution_id UUID REFERENCES vendors(id),
            name VARCHAR(255) NOT NULL,
            crop VARCHAR(100) NOT NULL,
            hectares NUMERIC(10,2) DEFAULT 1,
            location VARCHAR(255),
            trial_objective TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
         )
      `);

      const { name, crop, hectares, location, trial_objective } = req.body;
      const { rows } = await pool.query(`
         INSERT INTO trial_plots (institution_id, name, crop, hectares, location, trial_objective)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *
      `, [payload.id, name, crop, parseFloat(hectares) || 1, location, trial_objective]);

      return res.status(201).json({ success: true, data: rows[0], message: "Trial plot created successfully" });
   } catch (error) {
      console.error("Error creating trial plot:", error);
      return res.status(500).json({ success: false, error: "Failed to create trial plot" });
   }
};

export default institutionAdminController;

