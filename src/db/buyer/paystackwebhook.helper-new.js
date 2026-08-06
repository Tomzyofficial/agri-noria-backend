import pool from "../../lib/connect.js";
import {
  markPayoutCompletedByReference,
  markPayoutFailedByReference,
  hasIncompletePayouts,
  markOrderCompleted,
} from "./payouts.db-new.js";

/**
 * Call this from your existing Paystack webhook route after signature
 * verification. Handles transfer.success / transfer.failed / transfer.reversed
 * events and, if it was the last outstanding payout for an order, marks the
 * order Completed.
 *
 * IMPORTANT: this route must read the RAW request body (not JSON-parsed) to
 * verify the signature — see the express.raw() note in usage example below.
 *
 * @param {{ event: string, data: object }} payload - parsed webhook JSON body
 */
export async function handlePaystackTransferEvent(payload) {
  const { event, data } = payload;

  if (
    !["transfer.success", "transfer.failed", "transfer.reversed"].includes(
      event,
    )
  ) {
    return { handled: false, reason: `Ignored event type: ${event}` };
  }

  const reference = data.reference;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let payoutRef;
    if (event === "transfer.success") {
      payoutRef = await markPayoutCompletedByReference(client, reference, data);
    } else {
      payoutRef = await markPayoutFailedByReference(client, reference, {
        failureReason: data.reason || data.message || event,
        transferResponse: data,
      });
    }

    if (!payoutRef) {
      // Reference didn't match any payout we know about — log and move on,
      // don't throw (Paystack will retry the webhook if you return non-2xx).
      await client.query("ROLLBACK");
      return {
        handled: false,
        reason: `No payout found for reference ${reference}`,
      };
    }

    // Lock the parent order and check whether this was the last piece.
    await client.query(`SELECT id FROM orders WHERE id = $1 FOR UPDATE`, [
      payoutRef.order_id,
    ]);

    const stillIncomplete = await hasIncompletePayouts(
      client,
      payoutRef.order_id,
    );
    if (!stillIncomplete) {
      await markOrderCompleted(client, payoutRef.order_id);
    }

    await client.query("COMMIT");
    return {
      handled: true,
      orderId: payoutRef.order_id,
      orderCompleted: !stillIncomplete,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/*
USAGE in your existing webhook route (Express):

import express from "express";
import { verifyWebhookSignature } from "../services/paystack.service.js";
import { handlePaystackTransferEvent } from "./paystackWebhook.helper.js";

// Paystack webhooks need the RAW body for signature verification, so this
// route must NOT go through your global express.json() middleware.
router.post(
  "/webhooks/paystack",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).send("Invalid signature");
    }

    const payload = JSON.parse(req.body.toString("utf8"));

    // Respond fast — Paystack expects a 200 within a few seconds.
    res.sendStatus(200);

    try {
      await handlePaystackTransferEvent(payload);
    } catch (err) {
      console.error("Error handling Paystack webhook:", err);
      // Consider alerting here — the payout may be stuck in `processing`.
    }
  }
);
*/
