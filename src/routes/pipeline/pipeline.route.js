import express from "express";
import pipelineController from "../../controllers/pipeline/pipeline.controller.js";

const pipelineRoute = express.Router();

// Stats & Global Management (Specific routes first)
pipelineRoute.get("/pipeline/stats/platform-wallet", pipelineController.getPlatformWalletStats);
pipelineRoute.get("/pipeline/logistics/all", pipelineController.getAllLogistics);
pipelineRoute.post("/pipeline/logistics/update-status", pipelineController.updateLogisticsStatus);
pipelineRoute.get("/pipeline/warehouse/inventory", pipelineController.getWarehouseInventory);
pipelineRoute.get("/pipeline/distributors", pipelineController.getDistributors);

// Farmer Profiles
pipelineRoute.post("/pipeline/farmer-profile", pipelineController.createFarmerProfile);
pipelineRoute.get("/pipeline/farmer-profile/me", pipelineController.getMyFarmerProfile);
pipelineRoute.patch("/pipeline/farmer-profile/enroll", pipelineController.enrollInProgram);
pipelineRoute.get("/pipeline/farmers", pipelineController.getAllFarmers);

// Wallets
pipelineRoute.get("/pipeline/wallet", pipelineController.getMyWallet);
pipelineRoute.post("/pipeline/wallet/transfer", pipelineController.transferFunds);

// Clusters
pipelineRoute.post("/pipeline/clusters", pipelineController.createCluster);
pipelineRoute.get("/pipeline/clusters", pipelineController.getClusters);
pipelineRoute.get("/pipeline/clusters/mine", pipelineController.getMyCluster);
pipelineRoute.get("/pipeline/clusters/nearby", pipelineController.getNearbyClusters);
pipelineRoute.get("/pipeline/clusters/eligible-farmers", pipelineController.getEligibleFarmers);
pipelineRoute.post("/pipeline/clusters/assign", pipelineController.assignFarmer);
pipelineRoute.get("/pipeline/clusters/:id/members", pipelineController.getClusterMembers);
pipelineRoute.delete("/pipeline/clusters/:id/members/:farmerId", pipelineController.removeFarmer);

// Training
pipelineRoute.get("/pipeline/training", pipelineController.getTrainingProgress);
pipelineRoute.post("/pipeline/training/update", pipelineController.updateTraining);

// Input Requests
pipelineRoute.post("/pipeline/inputs/request", pipelineController.createInputRequest);
pipelineRoute.get("/pipeline/inputs/mine", pipelineController.getMyInputRequests);
pipelineRoute.get("/pipeline/inputs/pending", pipelineController.getPendingInputs);
pipelineRoute.get("/pipeline/inputs/all", pipelineController.getAllInputs);
pipelineRoute.patch("/pipeline/inputs/:id/approve-funds", pipelineController.approveFunds);
pipelineRoute.patch("/pipeline/inputs/:id/submit-items", pipelineController.submitInputItems);
pipelineRoute.patch("/pipeline/inputs/:id/approve-items", pipelineController.approveItems);

pipelineRoute.get("/pipeline/inputs/distributor", pipelineController.getDistributorInputs);
pipelineRoute.patch("/pipeline/inputs/:id/status", pipelineController.updateInputStatus);

// Planting
pipelineRoute.post("/pipeline/planting", pipelineController.createPlanting);
pipelineRoute.get("/pipeline/planting/mine", pipelineController.getMyPlanting);

// Field Verifications
pipelineRoute.post("/pipeline/verifications", pipelineController.createVerification);
pipelineRoute.get("/pipeline/verifications/cluster/:id", pipelineController.getClusterVerifications);

// Harvest
pipelineRoute.post("/pipeline/harvest", pipelineController.createHarvest);

// Supervision
pipelineRoute.get("/pipeline/supervision/:farmerId", pipelineController.getSupervision);
pipelineRoute.post("/pipeline/supervision/update", pipelineController.updateSupervision);

// Logistics
pipelineRoute.post("/pipeline/logistics", pipelineController.createLogistics);
pipelineRoute.get("/pipeline/logistics/cluster/:id", pipelineController.getClusterLogistics);

// Buyer Matches
pipelineRoute.post("/pipeline/buyer-matches", pipelineController.createBuyerMatch);
pipelineRoute.get("/pipeline/buyer-matches", pipelineController.getBuyerMatches);

// Sales
pipelineRoute.post("/pipeline/sales", pipelineController.createSale);
pipelineRoute.get("/pipeline/sales/cluster/:id", pipelineController.getClusterSales);

// Repayments
pipelineRoute.post("/pipeline/repayments", pipelineController.createRepayment);
pipelineRoute.patch("/pipeline/repayments/:id", pipelineController.processRepayment);

// Dashboard Stats
pipelineRoute.get("/pipeline/stats", pipelineController.getStats);
pipelineRoute.get("/pipeline/stats/sales", pipelineController.getSalesDashboardStats);
pipelineRoute.get("/pipeline/stats/intelligence", pipelineController.getIntelligenceDashboardStats);

// Ecosystem Buyer Orders
pipelineRoute.post("/pipeline/buyer-orders", pipelineController.createEcosystemOrder);
pipelineRoute.get("/pipeline/buyer-orders/mine", pipelineController.getEcosystemOrders);
pipelineRoute.get("/pipeline/buyer-orders/all", pipelineController.getAllEcosystemOrders);
pipelineRoute.post("/pipeline/buyer-orders/escrow-pay", pipelineController.processEscrowPayment);
pipelineRoute.post("/pipeline/buyer-orders/assign-distributor", pipelineController.assignOrderDistributor);
pipelineRoute.get("/pipeline/distributor/orders", pipelineController.getDistributorOrders);
pipelineRoute.post("/pipeline/distributor/mark-delivered", pipelineController.markOrderAsDelivered);

export default pipelineRoute;
