import { 
   getAllUsers, 
   getUserCountByRole, 
   getTotalUserCount, 
   getAllBuyers, 
   toggleUserSuspension,
   getAllAgreements,
   getAllEscrowPayments,
   getAllFinanceWallets,
   getAllWalletTransactions,
   getDashboardStats,
   getMonthlyUserGrowth,
   disburseFundsFromFinance,
   getAllEntityWallets,
   getAllAggregatorBuyers,
   getAggregatorsWithBuyerStats,
   getAllAuditLogs,
   getSystemSettings,
   updateSystemSettings
} from "../../db/admin/admin.db.js";
import { createAuditLog } from "../../utils/auditLogger.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const superAdminController = {};

// Middleware to check super admin role
const requireSuperAdmin = async (req, res, next) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const role = payload.account_type?.toLowerCase();
      if (role !== "super admin" && role !== "admin") {
         return res.status(403).json({ success: false, error: "Forbidden: Super Admin access required" });
      }
      req.adminPayload = payload;
      next();
   } catch {
      return res.status(500).json({ success: false, error: "Internal server error" });
   }
};

// Get all users with stats
superAdminController.getAllUsers = async (req, res) => {
   try {
      const [users, roleCounts, totalCount, buyers] = await Promise.all([
         getAllUsers(),
         getUserCountByRole(),
         getTotalUserCount(),
         getAllBuyers(),
      ]);

      return res.status(200).json({
         success: true,
         data: {
            totalVendors: totalCount,
            totalBuyers: buyers.length,
            roleCounts,
            vendors: users,
            buyers,
         },
      });
   } catch (error) {
      console.error("Error fetching all users:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch users" });
   }
};

// Toggle user suspension
superAdminController.toggleSuspension = async (req, res) => {
   try {
      const { userId, suspended } = req.body;
      if (!userId) {
         return res.status(400).json({ success: false, error: "User ID is required" });
      }

      const user = await toggleUserSuspension(userId, suspended);
      if (!user) {
         return res.status(404).json({ success: false, error: "User not found" });
      }

      // Log action
      await createAuditLog(
         req.adminPayload.id,
         req.adminPayload.email,
         suspended ? "SUSPEND" : "ACTIVATE",
         "User",
         `User account ${user.email} was ${suspended ? "suspended" : "activated"}`,
         req.ip
      );

      return res.status(200).json({
         success: true,
         message: `User ${suspended ? "suspended" : "activated"} successfully`,
         data: user,
      });
   } catch (error) {
      console.error("Error toggling suspension:", error);
      return res.status(500).json({ success: false, error: "Failed to update user status" });
   }
};

// Dashboard Stats
superAdminController.getDashboardStats = async (req, res) => {
   try {
      const stats = await getDashboardStats();
      // Ensure compatibility by providing both names
      return res.status(200).json({ 
         success: true, 
         data: {
            ...stats,
            finance_wallet_balance: stats.total_balance // Legacy compatibility
         } 
      });
   } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch dashboard stats" });
   }
};

// System Analytics — real data from DB
superAdminController.getSystemAnalytics = async (req, res) => {
   try {
      const [stats, roleCounts, monthlyData] = await Promise.all([
         getDashboardStats(),
         getUserCountByRole(),
         getMonthlyUserGrowth(),
      ]);

      const totalUsers = (stats.total_vendors || 0) + (stats.total_buyers || 0);

      const analytics = {
         totalUsers,
         totalVendors: stats.total_vendors || 0,
         totalBuyers: stats.total_buyers || 0,
         totalTransactions: stats.total_agreements || 0,
         escrowHeld: stats.escrow_held || 0,
         totalBalance: stats.total_balance || 0,
         systemHealth: 100,
         roleDistribution: roleCounts.map(r => ({
            name: r.account_type,
            count: parseInt(r.count)
         })),
         monthlyGrowth: monthlyData.map(row => ({
            month: row.month,
            users: parseInt(row.users),
            transactions: parseInt(row.transactions),
         })),
      };

      return res.status(200).json({ success: true, data: analytics });
   } catch (error) {
      console.error("Error fetching system analytics:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch system analytics" });
   }
};

// Finance Wallets
superAdminController.getFinanceWallets = async (req, res) => {
   try {
      const wallets = await getAllFinanceWallets();
      return res.status(200).json({ success: true, data: wallets });
   } catch (error) {
      console.error("Error fetching finance wallets:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch finance wallets" });
   }
};

// Wallet Transactions
superAdminController.getWalletTransactions = async (req, res) => {
   try {
      const transactions = await getAllWalletTransactions();
      return res.status(200).json({ success: true, data: transactions });
   } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch wallet transactions" });
   }
};

// Agreements
superAdminController.getAllAgreements = async (req, res) => {
   try {
      const agreements = await getAllAgreements();
      return res.status(200).json({ success: true, data: agreements });
   } catch (error) {
      console.error("Error fetching agreements:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch agreements" });
   }
};

// Escrow Payments
superAdminController.getAllEscrowPayments = async (req, res) => {
   try {
      const payments = await getAllEscrowPayments();
      return res.status(200).json({ success: true, data: payments });
   } catch (error) {
      console.error("Error fetching escrow payments:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch escrow payments" });
   }
};

// Get all platform buyers — returns BOTH aggregator-registered and direct
superAdminController.getAggregatorBuyers = async (req, res) => {
   try {
      const aggregatorBuyers = await getAllAggregatorBuyers();
      const ecosystemBuyers = await getAllBuyers();

      const combined = [
         ...aggregatorBuyers.map(b => ({
            id: b.id,
            buyer_name: b.buyer_name,
            buyer_email: b.buyer_email,
            buyer_phone: b.buyer_phone,
            buyer_type: 'aggregator',
            aggregator_id: b.aggregator_id,
            aggregator_fname: b.aggregator_fname,
            aggregator_lname: b.aggregator_lname,
            aggregator_email: b.aggregator_email,
            aggregator_phone: b.aggregator_phone,
            created_at: b.created_at
         })),
         ...ecosystemBuyers.map(b => ({
            id: b.buyer_id,
            buyer_name: b.name,
            buyer_email: b.email,
            buyer_phone: '',
            buyer_type: 'direct',
            aggregator_id: null,
            aggregator_fname: null,
            aggregator_lname: null,
            aggregator_email: null,
            aggregator_phone: null,
            created_at: b.created_at
         }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.status(200).json({ success: true, data: combined });
   } catch (error) {
      console.error("Error fetching buyers:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch buyers" });
   }
};

// Get aggregators with buyer stats (for grouped ecosystem view)
superAdminController.getAggregatorsWithStats = async (req, res) => {
   try {
      const aggregators = await getAggregatorsWithBuyerStats();
      return res.status(200).json({ success: true, data: aggregators });
   } catch (error) {
      console.error("Error fetching aggregator stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch aggregator stats" });
   }
};

// Middleware for Finance, Super Admin, Admin
const requireFinanceOrAdmin = async (req, res, next) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      
      const role = payload.account_type?.toLowerCase();
      if (!["super admin", "admin", "finance", "institution", "sales-manager"].includes(role)) {
         return res.status(403).json({ success: false, error: "Forbidden: Finance or Admin access required" });
      }
      req.adminPayload = payload;
      next();
   } catch {
      return res.status(500).json({ success: false, error: "Internal server error" });
   }
};

// Get all entity wallets for dropdown
superAdminController.getEntityWallets = async (req, res) => {
   try {
      const wallets = await getAllEntityWallets();
      return res.status(200).json({ success: true, data: wallets });
   } catch (error) {
      console.error("Error fetching entity wallets:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch entity wallets" });
   }
};

// Disburse funds manually
superAdminController.disburseFunds = async (req, res) => {
   try {
      const { target_wallet_id, amount, description } = req.body;
      const financeUserId = req.adminPayload.id;

      if (!target_wallet_id || !amount) {
         return res.status(400).json({ success: false, error: "Target wallet and amount are required" });
      }

      await disburseFundsFromFinance(financeUserId, target_wallet_id, amount, description);
      
      // Log action
      await createAuditLog(
         req.adminPayload.id,
         req.adminPayload.email,
         "DISBURSE",
         "Wallet",
         `Disbursed ${amount} to wallet ${target_wallet_id}. Description: ${description}`,
         req.ip
      );

      return res.status(200).json({ 
         success: true, 
         message: "Funds disbursed successfully" 
      });
   } catch (error) {
      console.error("Error disbursing funds:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to disburse funds" });
   }
};

// Get audit logs
superAdminController.getAuditLogs = async (req, res) => {
   try {
      const logs = await getAllAuditLogs();
      return res.status(200).json({ success: true, data: logs });
   } catch (error) {
      console.error("Error fetching audit logs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
   }
};

// Get system settings
superAdminController.getSettings = async (req, res) => {
   try {
      const settings = await getSystemSettings();
      // Default settings if empty
      const defaultSettings = {
         platformName: "AgriNoria",
         platformEmail: "support@agrinoria.com",
         maintenanceMode: false,
         maxLoginAttempts: 5,
         sessionTimeout: 30,
         emailVerificationRequired: true,
         twoFactorRequired: false,
         maxUploadSize: 50,
      };
      
      const merged = { ...defaultSettings, ...settings };
      return res.status(200).json({ success: true, data: merged });
   } catch (error) {
      console.error("Error fetching settings:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch settings" });
   }
};

// Update system settings
superAdminController.updateSettings = async (req, res) => {
   try {
      const settings = req.body;
      await updateSystemSettings(settings);
      
      // Log action
      await createAuditLog(
         req.adminPayload.id,
         req.adminPayload.email,
         "UPDATE",
         "Settings",
         "System settings were updated",
         req.ip
      );
      
      return res.status(200).json({ success: true, message: "Settings updated successfully" });
   } catch (error) {
      console.error("Error updating settings:", error);
      return res.status(500).json({ success: false, error: "Failed to update settings" });
   }
};

export { superAdminController, requireSuperAdmin, requireFinanceOrAdmin };
