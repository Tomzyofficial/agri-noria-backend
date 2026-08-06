import pool from "../../lib/connect.js";
import { releaseEscrowForOrder } from "./escrow.service-new.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";
/**
 * POST /api/buyer/orders/:orderId/verify
 * Buyer confirms receipt of their order, triggering an immediate escrow release
 * attempt (rather than waiting for the 24h auto-release job).
 */
export async function verifyOrderController(req, res) {
  const verifyToken = await verifyBuyerToken(req);
  const { orderId } = req.params;
  const buyerId = verifyToken.buyer_id; // adjust to however you attach the authenticated buyer

  try {
    // Confirm this order actually belongs to the requesting buyer before
    // touching anything — don't let buyer A release buyer B's escrow.
    const { rows } = await pool.query(
      `SELECT id, status FROM orders WHERE id = $1 AND buyer_id = $2`,
      [orderId, buyerId],
    );

    const order = rows[0];
    console.log(order)
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        message: `Order must be in 'Delivered' status to verify. Current status: ${order.status}`,
      });
    }

    const result = await releaseEscrowForOrder(orderId, { trigger: "manual" });

    return res.status(200).json({
      message: result.completed
        ? "Order verified and payouts completed."
        : "Order verified. Payouts are being processed.",
      data: result,
    });
  } catch (err) {
    console.error("Error verifying order:", err);
    return res.status(500).json({ message: "Failed to verify order" });
  }
}
