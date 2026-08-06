import express from "express";
import { verifyOrderController } from "../controllers/orders/verifyOrder.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js"; // adjust to your actual auth middleware

const router = express.Router();

/**
 * Buyer clicks "Verify delivery / Release payment" on their order details page.
 * requireAuth should populate req.user (used by verifyOrderController to check
 * req.user.id against orders.buyer_id) — adjust the import above to match
 * whatever middleware you're already using elsewhere (e.g. your JWT/jose verify).
 */
router.post("/:orderId/verify", requireAuth, verifyOrderController);

export default router;

/*
MOUNT THIS in your main app/router setup (wherever you register other buyer routes),
matching the path your frontend already calls:

import buyerOrdersRoutes from "./routes/buyerOrders.routes.js";
app.use("/api/proxy/buyer/orders", buyerOrdersRoutes);

That makes the buyer's dashboard button POST to:
  /api/proxy/buyer/orders/:orderId/verify

If you already have a buyer orders router file (e.g. handling GET /:orderId,
GET /, etc.), just add the verify route above into that existing router instead
of mounting a new one — don't create a second router on the same base path.
*/
