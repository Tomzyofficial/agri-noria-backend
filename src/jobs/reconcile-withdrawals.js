import { reconcileWithdrawals } from "../lib/wallet/reconcile-withdrawals.js";
import cron from "node-cron";

export function startWithdrawalReconciliationJob() {
  let isRunning = false;

  cron.schedule("*/30 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await reconcileWithdrawals();
      console.log("[reconciled withdrawals] Done:", result);
    } catch (err) {
      console.error("[reconciled withdrawals] Job crashed:", err);
    } finally {
      isRunning = false;
    }
  });

  console.log(
    "[reconciled withdrawals] Cron job registered (every 30 minutes).",
  );
}
