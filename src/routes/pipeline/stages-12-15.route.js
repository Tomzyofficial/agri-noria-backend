import express from "express";
import { requireVendorAuth } from "../../middlewares/vendorAuth.js";


// Import stage controllers
import stage12Controller from "../../controllers/pipeline/stage12-matching.controller.js";
import stage13Controller from "../../controllers/pipeline/stage13-settlement.controller.js";
import stage14Controller from "../../controllers/pipeline/stage14-repayment.controller.js";
import stage15Controller from "../../controllers/pipeline/stage15-intelligence.controller.js";

const router = express.Router();

// ============ STAGE 12: BUYER/OFFTAKER MATCHING ============
router.post("/stage12/listing", requireVendorAuth, stage12Controller.createMarketplaceListing);
router.get("/stage12/listings", stage12Controller.getMarketplaceListings);
router.post("/stage12/offer", requireVendorAuth, stage12Controller.submitBuyerOffer);
router.get("/stage12/listing/:listing_id/offers", stage12Controller.getListingOffers);

// ============ STAGE 13: SALES & SETTLEMENT ============
router.post("/stage13/contract", requireVendorAuth, stage13Controller.createSalesContract);
router.post("/stage13/sale", requireVendorAuth, stage13Controller.recordSale);
router.post("/stage13/settle", requireVendorAuth, stage13Controller.settleSale);
router.get("/stage13/sales", requireVendorAuth, stage13Controller.getSalesForAggregator);

// ============ STAGE 14: REPAYMENT & RECONCILIATION ============
router.post("/stage14/repayment", requireVendorAuth, stage14Controller.createFinancingRepayment);
router.post("/stage14/record-repayment", requireVendorAuth, stage14Controller.recordRepayment);
router.put("/stage14/credit-score", requireVendorAuth, stage14Controller.updateCreditScore);
router.get("/stage14/credit-score/:vendor_id", stage14Controller.getCreditScore);

// ============ STAGE 15: REPORTING & INTELLIGENCE ============
router.post("/stage15/metrics", requireVendorAuth, stage15Controller.recordSystemMetrics);
router.post("/stage15/yield-forecast", requireVendorAuth, stage15Controller.recordYieldForecast);
router.post("/stage15/climate-risk", requireVendorAuth, stage15Controller.recordClimateRisk);
router.post("/stage15/report", requireVendorAuth, stage15Controller.generateInstitutionalReport);
router.get("/stage15/metrics", stage15Controller.getSystemMetrics);
router.get("/stage15/climate-risks", stage15Controller.getClimateRisks);

export default router;
