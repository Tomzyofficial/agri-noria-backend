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

// Organization Members (Cooperative / Producer Association)
institutionAdminRoute.get("/members", institutionAdminController.getMembers);
institutionAdminRoute.post("/members/import", institutionAdminController.importMember);

// Polymorphic Groups (Member Clusters, Producer Groups, Research Cohorts)
institutionAdminRoute.get("/groups", institutionAdminController.getGroups);
institutionAdminRoute.post("/groups", institutionAdminController.createGroup);
institutionAdminRoute.post("/groups/assign", institutionAdminController.assignGroupMember);

// Producer Association Affiliations
institutionAdminRoute.get("/affiliations", institutionAdminController.getAffiliations);
institutionAdminRoute.post("/affiliations", institutionAdminController.affiliateCooperative);

// Research Projects & Scientific Trials
institutionAdminRoute.get("/research-projects", institutionAdminController.getResearchProjects);
institutionAdminRoute.post("/research-projects", institutionAdminController.createResearchProject);
institutionAdminRoute.post("/research-projects/funding", institutionAdminController.requestProjectFunding);
institutionAdminRoute.get("/research-observations", institutionAdminController.getObservations);
institutionAdminRoute.post("/research-observations", institutionAdminController.logObservation);

// Treasury Wallet Credit
institutionAdminRoute.get("/wallets", institutionAdminController.getEcosystemWallets);
institutionAdminRoute.post("/treasury/credit-wallet", institutionAdminController.creditUserWallet);

export default institutionAdminRoute;
