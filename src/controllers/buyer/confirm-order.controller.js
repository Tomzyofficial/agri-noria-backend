// controllers/order.controller.ts

import pool from "../../lib/connect.js";
import { creditVendorWalletsForOrder } from "../../lib/wallet/credit-order-payout.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";

// Adjust these to match your actual order status enum/strings.
const STATUS_AWAITING_CONFIRMATION = "delivered";
const STATUS_CONFIRMED = "completed";

// ---------------------------------------------------------
// PATCH /orders/:orderId/confirm
//
// Called when the buyer clicks "Confirm order received." This does
// TWO things atomically, in one DB transaction:
//   1. Moves the order from 'delivered' -> 'completed'
//   2. Credits every vendor's wallet (pending_balance) for this order
//
// Atomic on purpose: we never want a state where the order shows as
// confirmed but the vendor wasn't credited, or vice versa.
// ---------------------------------------------------------
export async function confirmOrder(req, res) {
  const payload = await verifyBuyerToken(req);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  const { orderId } = req.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the order row so a double-click, or two tabs open at once,
    // can't both pass the status check and both try to confirm.
    const orderResult = await client.query(
      `SELECT id, buyer_id, status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    // Ownership check — only the buyer who placed the order can confirm it.
    if (order.buyer_id !== payload.buyer_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "You cannot confirm this order" });
    }

    // Idempotency / valid-state check. If it's already confirmed, tell
    // the caller plainly rather than silently re-running the credit
    // logic (which is itself idempotent, but the order update isn't
    // meaningfully repeatable — confirmed_at shouldn't keep moving).
    if (order.status === STATUS_CONFIRMED) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "Order has already been confirmed" });
    }

    if (order.status !== STATUS_AWAITING_CONFIRMATION) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Order cannot be confirmed from its current status (${order.status})`,
      });
    }

    // 1. Move the order to 'completed'
    await client.query(
      `UPDATE orders
       SET status = $1, updated_at = now()
       WHERE id = $2`,
      [STATUS_CONFIRMED, orderId],
    );

    // 2. Credit every vendor's wallet for this order, in the SAME transaction.
    const creditResult = await creditVendorWalletsForOrder(orderId);

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Order confirmed",
      orderId,
      walletCrediting: creditResult,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Failed to confirm order ${orderId}:`, err);
    return res
      .status(500)
      .json({ error: "Something went wrong confirming this order" });
  } finally {
    client.release();
  }
}
