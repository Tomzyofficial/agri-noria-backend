import express from "express";
import { superAdminController, requireSuperAdmin, requireFinanceOrAdmin } from "../../controllers/admin/super.admin.controller.js";

const superAdminRoute = express.Router();

// User Management
superAdminRoute.get("/admin/users", requireSuperAdmin, superAdminController.getAllUsers);
superAdminRoute.patch("/admin/users/toggle-suspension", requireSuperAdmin, superAdminController.toggleSuspension);

// Dashboard & Statistics
superAdminRoute.get("/admin/dashboard/stats", requireSuperAdmin, superAdminController.getDashboardStats);
superAdminRoute.get("/admin/analytics", requireSuperAdmin, superAdminController.getSystemAnalytics);
superAdminRoute.get("/admin/finance-wallets", requireFinanceOrAdmin, superAdminController.getFinanceWallets);
superAdminRoute.get("/admin/wallet-transactions", requireFinanceOrAdmin, superAdminController.getWalletTransactions);
superAdminRoute.get("/admin/agreements", requireSuperAdmin, superAdminController.getAllAgreements);
superAdminRoute.get("/admin/escrow-payments", requireSuperAdmin, superAdminController.getAllEscrowPayments);
superAdminRoute.get("/admin/aggregator-buyers", requireSuperAdmin, superAdminController.getAggregatorBuyers);
superAdminRoute.get("/admin/aggregator-stats", requireSuperAdmin, superAdminController.getAggregatorsWithStats);
superAdminRoute.get("/admin/audit-logs", requireSuperAdmin, superAdminController.getAuditLogs);
superAdminRoute.get("/admin/settings", requireSuperAdmin, superAdminController.getSettings);
superAdminRoute.put("/admin/settings", requireSuperAdmin, superAdminController.updateSettings);

// Wallets & Disbursements
superAdminRoute.get("/admin/entity-wallets", requireFinanceOrAdmin, superAdminController.getEntityWallets);
superAdminRoute.post("/admin/disburse", requireFinanceOrAdmin, superAdminController.disburseFunds);

export default superAdminRoute;
