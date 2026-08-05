import express from "express";
import institutionAdminController from "../../controllers/admin/institution.admin.controller.js";

const institutionAdminRoute = express.Router();

// Institution analytics
institutionAdminRoute.get("/analytics", institutionAdminController.getAnalytics);
institutionAdminRoute.get("/portfolio", institutionAdminController.getPortfolio);
institutionAdminRoute.get("/impact", institutionAdminController.getImpact);
institutionAdminRoute.get("/transactions", institutionAdminController.getTransactions);
institutionAdminRoute.put("/profile", institutionAdminController.updateProfile);

// Input Approvals & Assignments
institutionAdminRoute.get("/pending-requests", institutionAdminController.getPendingRequests);
institutionAdminRoute.get("/distributors", institutionAdminController.getDistributors);
institutionAdminRoute.post("/approve-funds", institutionAdminController.approveFunds);
institutionAdminRoute.post("/assign-distributor", institutionAdminController.assignDistributor);
institutionAdminRoute.post("/payout-distributor", institutionAdminController.payoutDistributor);

// Missing Pages endpoints
institutionAdminRoute.get("/monitoring", institutionAdminController.getMonitoring);
institutionAdminRoute.get("/escrow", institutionAdminController.getEscrow);
institutionAdminRoute.get("/procurement", institutionAdminController.getProcurement);
institutionAdminRoute.get("/traceability", institutionAdminController.getTraceability);
institutionAdminRoute.get("/reports", institutionAdminController.getReports);
institutionAdminRoute.get("/extension", institutionAdminController.getExtension);
institutionAdminRoute.get("/ngo-distribution", institutionAdminController.getNgoDistribution);
institutionAdminRoute.get("/cooperatives", institutionAdminController.getCooperatives);
institutionAdminRoute.get("/trial-plots", institutionAdminController.getTrialPlots);
institutionAdminRoute.post("/trial-plots", institutionAdminController.createTrialPlot);

// Treasury Wallet Credit
institutionAdminRoute.get("/wallets", institutionAdminController.getEcosystemWallets);
institutionAdminRoute.post("/treasury/credit-wallet", institutionAdminController.creditUserWallet);

export default institutionAdminRoute;
