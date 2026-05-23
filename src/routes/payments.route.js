import express from "express";
import {
  initializeBuyerPayment,
  verifyBuyerPayment,
  getPaymentByIdController,
  getPaymentByOrderIdController,
  getPaymentByReferenceController,
  updatePaymentStatusController,
  updateEscrowStatusController,
  getPayerPaymentsController,
  getSellerPaymentsController,
  refundPaymentController,
  getSellerPaymentStatsController,
  getPayerPaymentStatsController,
  getHeldEscrowPaymentsController,
} from "../controllers/payments.controller.js";

const paymentsRoute = express.Router();

// Create a new payment
paymentsRoute.post("/payment/initialize", initializeBuyerPayment);

paymentsRoute.get("/payment/verify", verifyBuyerPayment);

// Get payment by ID
paymentsRoute.get("/payments/:id", getPaymentByIdController);

// Get payment by order ID
paymentsRoute.get("/payments/order/:order_id", getPaymentByOrderIdController);

// Get payment by provider reference (for webhooks)
paymentsRoute.get(
  "/payments/reference/:reference",
  getPaymentByReferenceController,
);

// Update payment status (for webhooks)
paymentsRoute.put("/payments/:id/status", updatePaymentStatusController);

// Update escrow status
paymentsRoute.put("/payments/:id/escrow-status", updateEscrowStatusController);

// Get payments by payer ID
paymentsRoute.get("/payments/payer/:payer_id", getPayerPaymentsController);

// Get payments by seller ID
paymentsRoute.get("/payments/seller/:seller_id", getSellerPaymentsController);

// Refund payment
paymentsRoute.put("/payments/:id/refund", refundPaymentController);

// Get seller payment statistics
paymentsRoute.get(
  "/payments/seller/:seller_id/stats",
  getSellerPaymentStatsController,
);

// Get payer payment statistics
paymentsRoute.get(
  "/payments/payer/:payer_id/stats",
  getPayerPaymentStatsController,
);

// Get held escrow payments (for auto-release)
paymentsRoute.get("/payments/held-escrow", getHeldEscrowPaymentsController);

export default paymentsRoute;
