import express from "express";
import { 
  getRiskRequests, 
  provideQuote, 
  getActivePolicies,
  simulateRequest,
  acceptQuote
} from "../../controllers/vendor/commodity-operations/insurance.controller.js";
import {
  declareHarvest,
  getMyBatches,
  requestStorage,
  requestLogistics
} from "../../controllers/vendor/commodity-operations/harvest.controller.js";
import { requireVendorAuth } from "../../middlewares/vendorAuth.js";
import {
  getStorageDashboardStats,
  getIncomingTickets,
  acceptStorageTicket,
  updateStorageSettings
} from "../../controllers/vendor/commodity-operations/storage.controller.js";

const router = express.Router();

router.use(requireVendorAuth);

// Insurance Routes
router.get("/insurance/requests", getRiskRequests);
router.post("/insurance/quote", provideQuote);
router.get("/insurance/policies", getActivePolicies);
router.post("/insurance/simulate", simulateRequest);
router.post("/insurance/accept", acceptQuote);

// Harvest / Storage Routes
router.get("/harvest/batches", getMyBatches);
router.post("/harvest/declare", declareHarvest);
router.post("/harvest/request-storage", requestStorage);

// Storage Provider Routes
router.get("/storage/dashboard", getStorageDashboardStats);
router.get("/storage/tickets", getIncomingTickets);
router.post("/storage/tickets/:ticket_id/accept", acceptStorageTicket);
router.post("/storage/settings", updateStorageSettings);

// Logistics Provider Routes
import {
  getLogisticsDashboardStats,
  getIncomingLogisticsTickets,
  acceptLogisticsTicket
} from "../../controllers/vendor/commodity-operations/logistics.controller.js";

router.post("/harvest/request-logistics", requestLogistics);
router.get("/logistics/dashboard", getLogisticsDashboardStats);
router.get("/logistics/tickets", getIncomingLogisticsTickets);
router.post("/logistics/tickets/:ticket_id/accept", acceptLogisticsTicket);

export default router;
