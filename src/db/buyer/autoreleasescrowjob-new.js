import { findOrdersEligibleForAutoRelease } from "./payouts.db-new.js";
import { releaseEscrowForOrder } from "../services/escrow.service.js";

import cron from "node-cron";
// import { runAutoReleaseEscrowJob } from "./jobs/autoReleaseEscrow.";

/**
 * Run this on a schedule (e.g. every 15-30 min via node-cron or a scheduled
 * worker/cron job outside the app process).
 *
 * Handles both:
 *  - true 24h auto-release (buyer never clicked verify)
 *  - retrying orders whose previous release attempt left some payouts
 *    pending/failed (e.g. a transient Paystack error, insufficient balance)
 */
export async function runAutoReleaseEscrowJob() {
  const orderIds = await findOrdersEligibleForAutoRelease();

  console.log(`[autoReleaseEscrow] ${orderIds.length} order(s) eligible`);

  const results = [];
  for (const orderId of orderIds) {
    try {
      const result = await releaseEscrowForOrder(orderId, { trigger: "auto" });
      results.push(result);
    } catch (err) {
      // One order failing shouldn't stop the batch.
      console.error(`[autoReleaseEscrow] Failed for order ${orderId}:`, err.message);
      results.push({ orderId, error: err.message });
    }
  }

  return results;
}


// Every 30 minutes
cron.schedule("*/30 * * * *", () => {
  runAutoReleaseEscrowJob().catch((err) =>
    console.error("[autoReleaseEscrow] Job crashed:", err)
  );
});
