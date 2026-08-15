import { releaseEligiblePendingBalances } from "../lib/wallet/release-pending-balance.js";
import cron from "node-cron";

export const HOLD_WINDOW_MINUTES = 5;
let isRunning = false;

// ---------------------------------------------------------
// Registers the schedule. Call this ONCE, from your server's entry
// point, after the app has started — not as a side effect of just
// importing this file. This makes "is the job running?" a matter of
// checking one obvious line in your startup code, rather than hoping
// some transitive import happened to pull this file in.
// ---------------------------------------------------------
export function startPendingBalanceReleaseJob() {
  cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
      console.warn(
        "[release pending balances] Previous run still in progress — skipping this tick.",
      );
      return;
    }

    isRunning = true;
    const startedAt = Date.now();

    try {
      const result = await releaseEligiblePendingBalances();
      console.log(
        `[release pending balances] Done in ${Date.now() - startedAt}ms — ` +
          `released: ${result.releasedCount}, skipped: ${result.skippedCount}, ` +
          `total: ${result.totalReleased}`,
      );
    } catch (err) {
      console.error("[release pending balances] Job crashed:", err);
    } finally {
      isRunning = false;
    }
  });

  console.log(
    `[release pending balances] Cron job registered (every 5 minutes, ${HOLD_WINDOW_MINUTES}m hold).`,
  );
}
