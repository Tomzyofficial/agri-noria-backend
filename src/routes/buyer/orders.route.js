import express from "express";
import {
  createOrderController,
  getOrderByIdController,
  getBuyerOrdersController,
  getSellerOrdersController,
  updateOrderStatusController,
  //   cancelOrderController,
  getSellerOrderStatsController,
  getBuyerOrderStatsController,
  confirmBuyerSatisfactionController,
} from "../../controllers/buyer/orders.controller.js";

const ordersRoute = express.Router();

// Create a new order
ordersRoute.post("/create-order", createOrderController);

// SPECIFIC routes MUST come BEFORE parameterized routes to avoid :id matching them
// Get buyer order statistics
ordersRoute.get("/orders/stats", getBuyerOrderStatsController);

// Get orders by buyer ID
ordersRoute.get("/orders", getBuyerOrdersController);

// Get seller order statistics (must be before /seller/:seller_id)
ordersRoute.get("/orders/seller/stats", getSellerOrderStatsController);

// Get orders by seller ID
ordersRoute.get("/orders/seller/:seller_id", getSellerOrdersController);

// Get order by ID (parameterized - AFTER specific routes)
ordersRoute.get("/orders/:id", getOrderByIdController);

// Update order status
ordersRoute.put("/orders/:id/status", updateOrderStatusController);

// Cancel order
// ordersRoute.put("/orders/:id/cancel", cancelOrderController);

// Confirm buyer satisfaction with OTP
ordersRoute.post(
  "/orders/:id/confirm-satisfaction",
  confirmBuyerSatisfactionController,
);

export default ordersRoute;
