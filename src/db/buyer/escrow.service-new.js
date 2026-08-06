import pool from "../../lib/connect.js";
import { createTransferRecipient, initiateBulkTransfer } from "./paystack.service-new.js";
import {
  lockOrderForRelease,
  lockPendingOrFailedPayouts,
  hasIncompletePayouts,
  saveRecipientCode,
  markPayoutProcessing,
  markPayoutFailedImmediate,
  markOrderCompleted,
} from "./payouts.db-new.js";

/**
 * Releases escrow for a single order: finds pending/failed payouts, ensures
 * each vendor has a Paystack recipient, fires a bulk transfer, and updates
 * payout rows based on what the bulk call immediately reports.
 *
 * Final settlement (completed/failed) happens in the webhook handler once
 * Paystack confirms each transfer asynchronously — this function only gets
 * transfers to "processing".
 *
 * Safe to call repeatedly for the same order: already-completed payouts are
 * skipped, and the order row lock prevents two callers racing on the same order.
 *
 * @param {string} orderId
 * @param {{ trigger: 'manual' | 'auto' }} [options]
 */
export async function releaseEscrowForOrder(
  orderId,
  { trigger = "manual" } = {},
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const order = await lockOrderForRelease(client, orderId);
    console.log("order from escro service new", order)
    if (!order) {
      await client.query("ROLLBACK");
      return {
        orderId,
        skipped: true,
        reason: "Order not found or not in Delivered status",
      };
    }

    const payoutsToProcess = await lockPendingOrFailedPayouts(client, orderId);
    console.log("payout to process", payoutsToProcess)

    if (payoutsToProcess.length === 0) {
      // Nothing pending/failed — either everything's already processing
      // (waiting on webhooks) or already completed. If fully completed, close the order.
      const stillIncomplete = await hasIncompletePayouts(client, orderId);
      if (!stillIncomplete) {
        await markOrderCompleted(client, orderId);
        await client.query("COMMIT");
        return { orderId, completed: true, transferred: [] };
      }
      await client.query("COMMIT");
      return {
        orderId,
        skipped: true,
        reason: "Remaining payouts are already processing",
      };
    }

    // Ensure every vendor in this batch has a Paystack recipient_code.
    for (const payout of payoutsToProcess) {
      console.log("for loop", payout)
      if (!payout.paystack_recipient_code) {
        if (!payout.bank_code) {
         console.log("no bank code for vendor")
          // Can't create a recipient without a bank_code — fail this payout now
          // rather than let it silently hang.
          await markPayoutFailedImmediate(client, payout.id, {
            reference: null,
            failureReason: "Vendor bank account is missing bank_code",
          });
          payout._skip = true;
          continue;
        }

        const recipientCode = await createTransferRecipient({
          account_name: payout.account_name,
          account_number: payout.account_number,
          bank_code: payout.bank_code,
          currency: payout.currency,
        });

        console.log("respi", recipientCode)

        await saveRecipientCode(client, payout.bank_account_id, recipientCode);
        payout.paystack_recipient_code = recipientCode;
      }
    }

    const eligiblePayouts = payoutsToProcess.filter((p) => !p._skip);

    if (eligiblePayouts.length === 0) {
      await client.query("COMMIT");
      return {
        orderId,
        skipped: true,
        reason: "No payouts eligible after recipient checks",
      };
    }

    // One transfer reference per payout attempt — reused as the lookup key when
    // the webhook fires later, so keep it unique per attempt, not per payout.
    const transfers = eligiblePayouts.map((p) => ({
      recipient_code: p.paystack_recipient_code,
      amount: Math.round(Number(p.net_amount) * 100), // NGN -> kobo
      reference: `payout_${p.id}_${Date.now()}`,
      reason: `Payout for order ${orderId}`,
    }));
    console.log("from escrow service file", transfers)

    let bulkResult;
    try {
      bulkResult = await initiateBulkTransfer(
        transfers,
        eligiblePayouts[0].currency || "NGN",
      );
    } catch (err) {
      // Whole batch rejected (e.g. insufficient balance, invalid auth) — mark all as failed
      // so the next periodic run retries them, rather than leaving them stuck as pending.
      for (const p of eligiblePayouts) {
        await markPayoutFailedImmediate(client, p.id, {
          reference: null,
          failureReason: err.message,
          transferResponse: err.paystackResponse,
        });
      }
      await client.query("COMMIT");
      return { orderId, error: err.message, transferred: [] };
    }

    // Match Paystack's per-transfer results back to our payout rows by reference.
    const resultByReference = new Map(bulkResult.map((r) => [r.reference, r]));

    for (const p of eligiblePayouts) {
      const transferAttempt = transfers.find(
        (t) => t.recipient_code === p.paystack_recipient_code,
      );
      const result = resultByReference.get(transferAttempt.reference);

      if (
        !result ||
        result.status === "failed" ||
        result.status === "reversed"
      ) {
        await markPayoutFailedImmediate(client, p.id, {
          reference: transferAttempt.reference,
          failureReason: result?.message || "Transfer rejected by Paystack",
          transferResponse: result,
        });
      } else {
        // status is typically "success" (meaning "queued") or "otp" (blocked, needs OTP
        // disabled on your Paystack dashboard) at this point — actual settlement
        // confirmation comes via webhook.
        await markPayoutProcessing(client, p.id, {
          reference: transferAttempt.reference,
          transferResponse: result,
        });
      }
    }

    await client.query("COMMIT");
    return { orderId, trigger, transferred: eligiblePayouts.map((p) => p.id) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
