import express from "express";
import { aggregatorController } from "../../controllers/aggregator/aggregator.controller.js";

const router = express.Router();

// Profile
router.post("/profile", aggregatorController.setupProfile);
router.get("/profile", aggregatorController.getProfile);

// Buyers & Agreements
router.post("/buyer-registration", aggregatorController.createBuyerRegistration);
router.get("/agreements", aggregatorController.getAgreements);
router.post("/upload-signed-agreement", aggregatorController.uploadSignedAgreement);

// Escrow & Finance Wallets (Finance/Super Admin only)
router.post("/release-escrow", aggregatorController.releaseEscrow);
router.get("/finance-wallets", aggregatorController.getFinanceWallets);
router.get("/finance-wallet/me", aggregatorController.getMyFinanceWallet);

// Public Routes (Review & Payment)
router.get("/review-agreement/:token", aggregatorController.getAgreementForReview);
router.post("/initialize-payment/:token", aggregatorController.initializePayment);

// Marketplace, Settings & Wallet
router.get("/marketplace-data", aggregatorController.getMarketplaceData);
router.put("/settings", aggregatorController.updateSettings);
router.get("/my-wallet", aggregatorController.getWallet);

export default router;
