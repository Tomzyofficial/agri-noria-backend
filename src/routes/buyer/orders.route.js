import express from "express";
import {
  createOrderController,
  getBuyerOrdersController,
  getSellerOrdersController,
  //   updateOrderStatusController,
  getSellerOrderStatsController,
  getBuyerOrderStatsController,
  //   confirmBuyerSatisfactionController,
} from "../../controllers/buyer/orders.controller.js";
import { confirmOrder } from "../../controllers/buyer/confirm-order.controller.js";

const ordersRoute = express.Router();

// Create a new order
ordersRoute.post("/create-order", createOrderController);

// SPECIFIC routes MUST come BEFORE parameterized routes to avoid :id matching them
// Get buyer order statistics
ordersRoute.get("/orders/stats", getBuyerOrderStatsController);

// Get orders by buyer ID
ordersRoute.get("/orders", getBuyerOrdersController);

// Get seller order statistics
ordersRoute.get("/orders/seller/stats", getSellerOrderStatsController);

// Get orders by seller ID
ordersRoute.get("/orders/seller", getSellerOrdersController);

// Update order status
// ordersRoute.put("/orders/:id/status", updateOrderStatusController);

// Confirm buyer satisfaction with OTP
// ordersRoute.post(
//   "/orders/:id/confirm-satisfaction",
//   confirmBuyerSatisfactionController,
// );

// Confirm order
ordersRoute.patch("/orders/:orderId/confirm-satisfaction", confirmOrder);

export default ordersRoute;
