import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '../src/controllers/pipeline/pipeline.controller.js');
let content = fs.readFileSync(file, 'utf8');

const prefixToReplace = `import {
   createWallet, getWalletByOwner, depositLockedFunds, depositToClusterWallet,
   transferClusterToFarmer, getWalletTransactions,
   createFarmerProfile, getFarmerProfileByVendor, getAllFarmerProfiles,
   createCluster, getAllClusters, assignFarmerToCluster, getClusterMembers, removeFarmerFromCluster,
   getTrainingModules, getFarmerTrainingProgress, updateTrainingProgress,
   createInputRequest, updateInputRequestItems, getInputRequestsByFarmer, getPendingInputRequests, getAllInputRequests,
   approveInputFunds, submitInputItems, approveInputItems, getInputRequestsByDistributor, updateInputRequestStatus,
   createPlantingActivity, getPlantingByFarmer,
   getNearestClusters, getEligibleFarmersForCluster, getFarmerCluster,
   createFieldVerification, getVerificationsByCluster,
   getFarmSupervisionByFarmer, upsertFarmSupervision,`;

const properPrefix = `import {
   createWallet, getWalletByOwner, depositLockedFunds, depositToClusterWallet,
   transferClusterToFarmer, getWalletTransactions,
   createFarmerProfile, getFarmerProfileByVendor, getAllFarmerProfiles,
   createCluster, getAllClusters, assignFarmerToCluster, getClusterMembers, removeFarmerFromCluster,
   getTrainingModules, getFarmerTrainingProgress, updateTrainingProgress,
   createInputRequest, updateInputRequestItems, getInputRequestsByFarmer, getPendingInputRequests, getAllInputRequests,
   approveInputFunds, submitInputItems, approveInputItems, getInputRequestsByDistributor, updateInputRequestStatus,
   createPlantingActivity, getPlantingByFarmer,
   getNearestClusters, getEligibleFarmersForCluster, getFarmerCluster,
   createFieldVerification, getVerificationsByCluster,
   getFarmSupervisionByFarmer, upsertFarmSupervision,
   createHarvestApproval,
   createLogisticsEntry, getLogisticsByCluster,
   createBuyerMatch, getBuyerMatches,
   createSale, getSalesByCluster,
   createRepayment, updateRepayment,
   getPipelineStats,
   getAllDistributors,
   disableBuyerAccount,
   getSalesStats,
   getIntelligenceStats,
   getPlatformWalletTotals,
   getAllLogisticsEntries,
   updateLogisticsStatusDb,
   getWarehouseInventoryStats,
   addWarehouseStock,
   removeWarehouseStock,
   createEcosystemOrder, getEcosystemOrders, processEscrowPayment, assignOrderDistributor, getAllEcosystemOrders,
   getEcosystemOrdersByDistributor, markOrderDelivered,
   getDistributorStats
} from "../../db/pipeline/pipeline.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const INPUT_RATE_PER_HECTARE = 28000; // ₦28,000 per hectare for input financing

const pipelineController = {};

// ============ FARMER PROFILES ============

pipelineController.createFarmerProfile = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
`;

content = content.replace(prefixToReplace, properPrefix);

fs.writeFileSync(file, content);
console.log('Fixed pipeline.controller.js');
