import express from 'express';
import {
  createEscrowReleaseController,
  getEscrowReleaseByIdController,
  getEscrowReleasesByPaymentIdController,
  getEscrowReleasesByOrderIdController,
  releaseEscrowFundsController,
  autoReleaseEscrowController,
  getPendingEscrowReleasesController,
  getEscrowReleasesByTriggerTypeController,
  getEscrowStatsController,
  getSellerEscrowStatsController,
  createDeliveryConfirmationController,
  getDeliveryConfirmationByOrderIdController,
  verifyDeliveryOTPController,
  confirmDeliveryWithPhotoController,
  autoConfirmDeliveryController,
  getDeliveryConfirmationStatsController
} from '../controllers/escrow.controller.js';

const escrowRoute = express.Router();

// Create escrow release record
escrowRoute.post('/escrow/releases/create', createEscrowReleaseController);

// Get escrow release by ID
escrowRoute.get('/escrow/releases/:id', getEscrowReleaseByIdController);

// Get escrow releases by payment ID
escrowRoute.get('/escrow/releases/payment/:payment_id', getEscrowReleasesByPaymentIdController);

// Get escrow releases by order ID
escrowRoute.get('/escrow/releases/order/:order_id', getEscrowReleasesByOrderIdController);

// Release escrow funds
escrowRoute.post('/escrow/release', releaseEscrowFundsController);

// Auto-release escrow (cron job endpoint)
escrowRoute.post('/escrow/auto-release', autoReleaseEscrowController);

// Get pending escrow releases
escrowRoute.get('/escrow/releases/pending', getPendingEscrowReleasesController);

// Get escrow releases by trigger type
escrowRoute.get('/escrow/releases/trigger/:trigger_type', getEscrowReleasesByTriggerTypeController);

// Get escrow statistics
escrowRoute.get('/escrow/stats', getEscrowStatsController);

// Get seller escrow statistics
escrowRoute.get('/escrow/seller/:seller_id/stats', getSellerEscrowStatsController);

// Create delivery confirmation with OTP
escrowRoute.post('/escrow/delivery-confirmation/create', createDeliveryConfirmationController);

// Get delivery confirmation by order ID
escrowRoute.get('/escrow/delivery-confirmation/order/:order_id', getDeliveryConfirmationByOrderIdController);

// Verify delivery OTP
escrowRoute.post('/escrow/delivery-confirmation/verify-otp', verifyDeliveryOTPController);

// Confirm delivery with photo proof
escrowRoute.post('/escrow/delivery-confirmation/confirm-photo', confirmDeliveryWithPhotoController);

// Auto-confirm delivery (timeout)
escrowRoute.post('/escrow/delivery-confirmation/auto-confirm/:order_id', autoConfirmDeliveryController);

// Get delivery confirmation statistics
escrowRoute.get('/escrow/delivery-confirmation/stats', getDeliveryConfirmationStatsController);

export default escrowRoute;
